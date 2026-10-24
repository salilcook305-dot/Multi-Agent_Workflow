import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
from pptx import Presentation
from app.models import SlideData, UploadedFileMetadata

def parse_pptx_file(file_path: Path, original_filename: str) -> UploadedFileMetadata:
    """
    Parses a .pptx presentation file using python-pptx,
    extracting titles, bullet points, slide text, tables, and speaker notes.
    """
    prs = Presentation(str(file_path))
    slides_data: List[SlideData] = []
    total_words = 0

    for idx, slide in enumerate(prs.slides, start=1):
        slide_title = ""
        bullet_points: List[str] = []
        text_parts: List[str] = []

        # 1. Title shape check
        if slide.shapes.title and slide.shapes.title.text:
            slide_title = slide.shapes.title.text.strip()

        # 2. Iterate all shapes in slide
        for shape in slide.shapes:
            # Skip the title shape text since we already have it
            if shape == slide.shapes.title:
                continue

            # Text box or auto shape
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    p_text = paragraph.text.strip()
                    if p_text:
                        text_parts.append(p_text)
                        # Check if it looks like a bullet or list item
                        if paragraph.level > 0 or p_text.startswith(("-", "•", "*", "–")):
                            clean_bullet = re.sub(r"^[-•*–\s]+", "", p_text)
                            if clean_bullet:
                                bullet_points.append(clean_bullet)
                        elif len(p_text) < 150:
                            bullet_points.append(p_text)

            # Table shapes
            if shape.has_table:
                table = shape.table
                table_rows = []
                for row in table.rows:
                    row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_texts:
                        table_rows.append(" | ".join(row_texts))
                if table_rows:
                    text_parts.append("Table Data:\n" + "\n".join(table_rows))

        # 3. Speaker notes
        notes_text = ""
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()

        # Fallback title if none was formally marked
        if not slide_title and text_parts:
            slide_title = text_parts[0][:80]

        full_content = "\n".join(text_parts)
        words_in_slide = len(re.findall(r"\w+", f"{slide_title} {full_content} {notes_text}"))
        total_words += words_in_slide

        slides_data.append(SlideData(
            slide_number=idx,
            title=slide_title or f"Slide {idx}",
            content=full_content,
            notes=notes_text,
            bullet_points=bullet_points
        ))

    file_size = file_path.stat().st_size

    return UploadedFileMetadata(
        filename=file_path.name,
        original_name=original_filename,
        file_size_bytes=file_size,
        slide_count=len(slides_data),
        total_words=total_words,
        slides=slides_data
    )

def parse_text_or_markdown(file_path: Path, original_filename: str) -> UploadedFileMetadata:
    """
    Fallback parser for text, markdown, or text-based documents.
    Splits into slide-like sections using headings (#) or delimiters (---).
    """
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    # Split by markdown headers (#) or thematic breaks (---)
    sections = re.split(r"(?:\n---+\n|\n(?=##?\s))", raw_text)
    slides_data: List[SlideData] = []
    total_words = 0

    for idx, sec in enumerate(sections, start=1):
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.split("\n")
        title = lines[0].replace("#", "").strip()
        content = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
        bullets = [re.sub(r"^[-*•]\s*", "", l) for l in lines if l.strip().startswith(("-", "*", "•"))]

        total_words += len(re.findall(r"\w+", sec))
        slides_data.append(SlideData(
            slide_number=idx,
            title=title or f"Section {idx}",
            content=content,
            notes="",
            bullet_points=bullets
        ))

    if not slides_data:
        slides_data.append(SlideData(
            slide_number=1,
            title="Document Content",
            content=raw_text,
            notes="",
            bullet_points=[]
        ))
        total_words = len(re.findall(r"\w+", raw_text))

    return UploadedFileMetadata(
        filename=file_path.name,
        original_name=original_filename,
        file_size_bytes=file_path.stat().st_size,
        slide_count=len(slides_data),
        total_words=total_words,
        slides=slides_data
    )

def parse_document(file_path: Path, original_filename: str) -> UploadedFileMetadata:
    ext = file_path.suffix.lower()
    if ext in [".pptx", ".ppt"]:
        try:
            return parse_pptx_file(file_path, original_filename)
        except Exception as e:
            # If python-pptx fails (e.g. legacy binary .ppt), try reading strings or fallback
            if ext == ".ppt":
                raise ValueError(
                    f"Legacy binary .ppt format requires conversion. Please open in PowerPoint and Save As .pptx: {e}"
                )
            raise e
    else:
        return parse_text_or_markdown(file_path, original_filename)
