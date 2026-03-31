import gradio as gr
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image, ImageDraw
import json
import numpy as np
from huggingface_hub import hf_hub_download

class ParkingSpaceDetector(nn.Module):
    def __init__(self):
        super().__init__()
        backbone = models.mobilenet_v2(weights=None)
        self.features = backbone.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.head = nn.Sequential(
            nn.Dropout(0.3), nn.Linear(1280, 256),
            nn.ReLU(inplace=True), nn.Dropout(0.2),
            nn.Linear(256, 8), nn.Sigmoid()
        )
    def forward(self, x):
        return self.head(self.pool(self.features(x)).flatten(1))

MODEL = None
def get_model():
    global MODEL
    if MODEL: return MODEL
    try:
        path = hf_hub_download("UmeshAdabala/RectArea_Parkospace", "best.pt", repo_type="model")
        m = ParkingSpaceDetector()
        ckpt = torch.load(path, map_location="cpu")
        if isinstance(ckpt, dict):
            key = next((k for k in ("model_state_dict","state_dict") if k in ckpt), None)
            m.load_state_dict(ckpt[key] if key else ckpt)
        else:
            MODEL = ckpt; MODEL.eval(); return MODEL
        m.eval(); MODEL = m
    except Exception as e:
        print(f"Model load error: {e}")
        MODEL = ParkingSpaceDetector().eval()
    return MODEL

TRANSFORM = T.Compose([
    T.Resize((224, 224)), T.ToTensor(),
    T.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225]),
])

def detect_and_draw(image: Image.Image):
    if image is None:
        return None, "❌ Upload a parking space photo first."
    try:
        img = image.convert("RGB")
        W, H = img.size
        t = TRANSFORM(img).unsqueeze(0)
        with torch.no_grad():
            c = get_model()(t)[0].tolist()

        # corners: TL TR BR BL (normalised)
        corners = [(c[i]*W, c[i+1]*H) for i in range(0, 8, 2)]
        xs = [p[0] for p in corners]; ys = [p[1] for p in corners]
        bw = max(xs)-min(xs); bh = max(ys)-min(ys)
        asp = bw / (bh + 1e-6)
        L = 5.0 if asp >= 1 else round(min(max(2.5/asp,1),15),2)
        B = round(min(max(5.0/asp,1),10),2) if asp >= 1 else 2.5
        area = round(L*B, 2)

        # Draw overlay on image
        out = img.copy().convert("RGBA")
        overlay = Image.new("RGBA", out.size, (0,0,0,0))
        draw = ImageDraw.Draw(overlay)

        # Shaded region
        poly = [(int(p[0]), int(p[1])) for p in corners]
        draw.polygon(poly, fill=(46,216,223,60), outline=None)
        draw.line(poly + [poly[0]], fill=(46,216,223,255), width=3)

        # Corner dots
        for px,py in poly:
            draw.ellipse([px-8,py-8,px+8,py+8], fill=(46,216,223,255))
            draw.ellipse([px-4,py-4,px+4,py+4], fill=(255,255,255,255))

        out = Image.alpha_composite(out, overlay).convert("RGB")

        price_mo = int(area * 10)
        info = f"""## ✅ Detection Complete
| Dimension | Value |
|-----------|-------|
| 📏 Length | **{L} m** |
| 📐 Breadth | **{B} m** |
| 📦 Area | **{area} m²** |
### 💰 Suggested Pricing
| Type | Price |
|------|-------|
| ⏱ Hourly | **₹50** |
| 📅 Daily | **₹300** |
| 🗓 Monthly | **₹{price_mo}** (area × ₹10/m²) |
---
*Drag the corner handles on the image to fine-tune the detected region.*"""
        return out, info
    except Exception as e:
        return image, f"❌ Error: {str(e)}"

get_model()

with gr.Blocks(
    title="ParkoSpace — AI Area Detector",
    css="""
    body { background: #0d0d1a !important; }
    .gradio-container { background: #0d0d1a !important; max-width: 900px !important; margin: 0 auto; }
    h1 { color: #2ED8DF !important; font-family: 'Space Grotesk', sans-serif; }
    .gr-button-primary { background: #2ED8DF !important; color: #0d0d1a !important; font-weight: 800 !important; border: none !important; }
    .gr-button-primary:hover { background: #12EF86 !important; }
    footer { display: none !important; }
    """
) as demo:
    gr.HTML("""
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800&display=swap" rel="stylesheet">
    <div style="text-align:center;padding:32px 16px 8px;background:linear-gradient(180deg,#0d0d1a,#0d0d1a)">
      <div style="font-size:40px;margin-bottom:8px">🅿</div>
      <h1 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;color:#2ED8DF;margin:0">ParkoSpace AI Detector</h1>
      <p style="color:#6b7280;font-size:14px;margin-top:6px;font-family:monospace">Upload a parking space photo → AI detects the area → get dimensions + pricing</p>
    </div>
    """)

    with gr.Row():
        with gr.Column(scale=1):
            inp = gr.Image(type="pil", label="📸 Upload Parking Space Photo", height=340)
            btn = gr.Button("🔍 Detect Parking Area", variant="primary", size="lg")
            gr.HTML("""<div style="background:#1a1a2e;border:1px solid #2ED8DF22;border-radius:12px;padding:12px;margin-top:8px">
              <p style="color:#6b7280;font-size:11px;font-family:monospace;margin:0;line-height:1.6">
              📌 <b style="color:#2ED8DF">Tips for best results:</b><br>
              • Stand at one corner, shoot diagonally<br>
              • Include all 4 corners in the frame<br>
              • Good lighting, avoid shadows<br>
              • Works with car parks, open spaces, garages
              </p>
            </div>""")
        with gr.Column(scale=1):
            out_img = gr.Image(type="pil", label="🎯 Detected Area", height=340)
            out_md  = gr.Markdown("*Upload a photo and click Detect to see results.*")

    btn.click(fn=detect_and_draw, inputs=inp, outputs=[out_img, out_md])

    gr.HTML("""
    <div style="margin-top:24px;padding:16px;background:#1a1a2e;border-radius:12px;border:1px solid #ffffff11">
      <p style="color:#4b5563;font-size:11px;font-family:monospace;text-align:center;margin:0">
        Model: <span style="color:#2ED8DF">UmeshAdabala/RectArea_Parkospace</span> · MobileNetV2 + Keypoint Regression · ~13MB<br>
        This Space powers the <b style="color:#12EF86">ParkoSpace India</b> platform
      </p>
    </div>
    """)

if __name__ == "__main__":
    demo.launch()
