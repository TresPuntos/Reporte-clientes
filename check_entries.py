#!/usr/bin/env python3
import pdfplumber
import re

pdf_path = 'reportes_csv/intek-medical-final.pdf'
with pdfplumber.open(pdf_path) as pdf:
    text_lines = []
    for page in pdf.pages:
        page_text = page.extract_text()
        if page_text:
            text_lines.extend(page_text.split('\n'))
    
    # Find all lines with duration pattern and member
    entries = []
    for i, line in enumerate(text_lines):
        clean_line = line.strip()
        dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', clean_line)
        if dur_match and any(member in clean_line for member in ['Dani', 'Alberto', 'Joan', 'Jordi']):
            entries.append((i, clean_line))
    
    print(f"Total entries found with duration and member: {len(entries)}")
    print("\nFirst 10 entries:")
    for idx, (line_num, line) in enumerate(entries[:10]):
        print(f"{idx+1}. Line {line_num}: {line}")
    
    # Calculate total from all found durations
    total_seconds = 0
    for i, line in entries:
        dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', text_lines[i])
        if dur_match:
            h, m, s = int(dur_match.group(1)), int(dur_match.group(2)), int(dur_match.group(3))
            total_seconds += h * 3600 + m * 60 + s
    
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    print(f"\nTotal from all found entries: {hours}:{minutes:02d}:{seconds:02d}")

