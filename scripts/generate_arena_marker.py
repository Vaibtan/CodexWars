from __future__ import annotations

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
PNG_PATH = ROOT / "apps" / "mobile" / "assets" / "arena-marker.png"
PDF_PATH = ROOT / "output" / "pdf" / "codexwars-arena-marker-a4.pdf"
MARKER_WIDTH_MM = 180
IMAGE_SIZE_PX = 1_440


def generate_marker() -> None:
    random = Random(0xC0DE_2026)
    image = Image.new("RGB", (IMAGE_SIZE_PX, IMAGE_SIZE_PX), "white")
    draw = ImageDraw.Draw(image)
    border = 42
    draw.rectangle((border, border, IMAGE_SIZE_PX - border, IMAGE_SIZE_PX - border), outline="black", width=28)

    # A deterministic field of non-repeating corners gives ARKit/ARCore abundant
    # grayscale features while the large orientation glyph removes 180-degree ambiguity.
    cell = 104
    origin = 116
    for row in range(11):
        for column in range(11):
            left = origin + column * cell
            top = origin + row * cell
            inset = random.randint(11, 24)
            width = random.randint(25, 62)
            height = random.randint(25, 62)
            shape = random.randrange(4)
            x0 = left + inset
            y0 = top + random.randint(10, 35)
            x1 = min(left + cell - 8, x0 + width)
            y1 = min(top + cell - 8, y0 + height)
            if shape == 0:
                draw.rectangle((x0, y0, x1, y1), fill="black")
            elif shape == 1:
                draw.ellipse((x0, y0, x1, y1), fill="black")
            elif shape == 2:
                draw.polygon(((x0, y1), (x1, y1), (x0 + random.randint(8, width), y0)), fill="black")
            else:
                draw.line((x0, y0, x1, y1), fill="black", width=random.randint(10, 20))
                draw.line((x0, y1, x1, y0), fill="black", width=random.randint(6, 14))

    # Orientation glyph: a deliberately off-centre arrow and three unequal cutouts.
    draw.polygon(((720, 150), (915, 405), (805, 405), (805, 620), (635, 620), (635, 405), (525, 405)), fill="black")
    draw.ellipse((665, 250, 735, 320), fill="white")
    draw.rectangle((662, 365, 713, 428), fill="white")
    draw.polygon(((760, 470), (805, 520), (755, 535)), fill="white")

    # Four distinct corner signatures remain visible even under partial occlusion.
    draw.ellipse((92, 92, 260, 260), fill="black")
    draw.polygon(((1_180, 90), (1_350, 90), (1_350, 285)), fill="black")
    draw.rectangle((92, 1_175, 278, 1_348), fill="black")
    draw.ellipse((1_190, 1_190, 1_350, 1_350), outline="black", width=36)
    draw.line((1_215, 1_325, 1_325, 1_215), fill="black", width=28)

    PNG_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(PNG_PATH, format="PNG", optimize=True)


def generate_print_sheet() -> None:
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    page_width, page_height = A4
    marker_width = MARKER_WIDTH_MM * mm
    marker_x = (page_width - marker_width) / 2
    marker_y = 58 * mm

    canvas = Canvas(str(PDF_PATH), pagesize=A4, pageCompression=1)
    canvas.setTitle("CodexWars arena marker")
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawCentredString(page_width / 2, page_height - 18 * mm, "CODEXWARS ARENA MARKER")
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(page_width / 2, page_height - 24 * mm, "Print on A4 at 100% / Actual size - do not fit to page")
    canvas.drawImage(str(PNG_PATH), marker_x, marker_y, marker_width, marker_width, preserveAspectRatio=True, mask="auto")
    canvas.setLineWidth(0.5)
    canvas.line(marker_x, marker_y - 5 * mm, marker_x + marker_width, marker_y - 5 * mm)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(marker_x, marker_y - 12 * mm, "Verification")
    canvas.setFont("Helvetica", 9)
    canvas.drawString(marker_x, marker_y - 18 * mm, "The black marker square must measure exactly 180 mm wide after printing.")
    canvas.drawString(marker_x, marker_y - 24 * mm, "Place it flat at arena centre, keep it wrinkle-free, matte, and evenly lit.")
    canvas.drawString(marker_x, marker_y - 30 * mm, "The arrow at the top defines the shared forward direction for every device.")
    canvas.showPage()
    canvas.save()


if __name__ == "__main__":
    generate_marker()
    generate_print_sheet()
