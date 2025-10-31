#!/usr/bin/env python3
import pdfplumber
import csv
import re

def clean_text(text):
    if not text:
        return ''
    return text.replace('\x00', ' ').strip()

def normalize_duration(duration):
    if not duration:
        return '00:00:00'
    parts = duration.replace(' ', '').split(':')
    if len(parts) == 3:
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        return f'{h:02d}:{m:02d}:{s:02d}'
    elif len(parts) == 2:
        h, m = int(parts[0]), int(parts[1])
        return f'{h:02d}:{m:02d}:00'
    return duration

def parse_entries(lines):
    entries = []
    i = 0
    processed_indices = set()  # Track which lines we've already processed
    
    while i < len(lines):
        if i in processed_indices:
            i += 1
            continue
            
        line_clean = clean_text(lines[i])
        
        # Skip headers
        if 'DESCRIPTION' in line_clean or 'DURATION' in line_clean or 'All time entries' in line_clean or 'Detailed report' in line_clean or 'Summary' in line_clean or ('Page' in line_clean and '/' in line_clean):
            i += 1
            continue
        
        # Look for a line with duration pattern
        dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', line_clean)
        if dur_match and 'Total' not in line_clean and 'Billable' not in line_clean:
            # Check if member is in same line or nearby
            member_in_same = bool(re.search(r'\b(Alberto|Dani|Joan|Jordi)\b', line_clean))
            member_nearby = False
            
            if not member_in_same:
                # Check lines before and after (within 3 lines)
                for j in range(max(0, i-3), min(len(lines), i+4)):
                    if j != i and j not in processed_indices:
                        nearby_line = clean_text(lines[j])
                        if re.search(r'\b(Alberto|Dani|Joan|Jordi)\b', nearby_line) and 'Total' not in nearby_line:
                            member_nearby = True
                            break
            
            # Try to parse if member is found (same line or nearby)
            if member_in_same or member_nearby:
                entry = parse_entry_from_line(lines, i)
                if entry:
                    entries.append(entry)
                    processed_indices.add(i)
                    i += 1
                    continue
        
        i += 1
    
    return entries

def parse_entry_from_line(lines, start_idx):
    """Parse entry starting from a line with duration pattern"""
    if start_idx >= len(lines):
        return None
    
    # Get the main line
    main_line = clean_text(lines[start_idx])
    
    # Extract duration
    dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', main_line)
    if not dur_match:
        return None
    
    duration = f"{dur_match.group(1)}:{dur_match.group(2)}:{dur_match.group(3)}"
    
    # Extract member - first check same line
    member_match = re.search(r'\b(Alberto|Dani|Joan|Jordi)\b', main_line)
    
    # If not in same line, look in nearby lines
    if not member_match:
        for j in range(max(0, start_idx - 3), min(len(lines), start_idx + 4)):
            if j != start_idx:
                nearby_line = clean_text(lines[j])
                member_match = re.search(r'\b(Alberto|Dani|Joan|Jordi)\b', nearby_line)
                if member_match and 'Total' not in nearby_line and 'DESCRIPTION' not in nearby_line:
                    break
    
    if not member_match:
        return None
    
    member_name = member_match.group(1)
    member = 'Alberto' if member_name == 'Jordi' else member_name
    
    # Extract project (look for "Intek Medical" or other project names)
    project = 'Intek Medical'  # Default
    project_match = re.search(r'•\s*(\w+(?:\s+\w+)?)', main_line)
    if project_match:
        project = project_match.group(1)
    
    # Look backwards for description
    desc_parts = []
    
    # Check immediate previous line
    if start_idx > 0:
        prev_line = clean_text(lines[start_idx - 1])
        
        # Skip if it's just a date or project marker
        if not re.match(r'^\d{2}/\d{2}/\d{4}\s*$', prev_line) and not re.match(r'^•.*', prev_line):
            # Skip if it's just a time range
            if not re.match(r'^•?\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s*$', prev_line):
                # Skip headers
                if 'DESCRIPTION' not in prev_line and 'DURATION' not in prev_line:
                    desc_candidate = prev_line.replace('•', '').strip()
                    # Remove date if present at end
                    desc_candidate = re.sub(r'\s+\d{2}/\d{2}/\d{4}\s*$', '', desc_candidate)
                    desc_candidate = re.sub(r'\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}', '', desc_candidate)
                    desc_candidate = desc_candidate.strip()
                    
                    # Check if it looks like a description
                    if desc_candidate and any(c.isalpha() for c in desc_candidate) and len(desc_candidate) > 2:
                        # Don't include if it's another entry line
                        if not (re.search(r'\d+:\d{2}:\d{2}', desc_candidate) and ('Dani' in desc_candidate or 'Alberto' in desc_candidate)):
                            desc_parts.append(desc_candidate)
        
        # Check one more line back
        if start_idx > 1 and not desc_parts:
            prev2_line = clean_text(lines[start_idx - 2])
            if prev2_line and 'DESCRIPTION' not in prev2_line and not re.match(r'^\d{2}/\d{2}/\d{4}\s*$', prev2_line) and not re.match(r'^•.*', prev2_line):
                desc_candidate = prev2_line.replace('•', '').strip()
                desc_candidate = re.sub(r'\s+\d{2}/\d{2}/\d{4}\s*$', '', desc_candidate)
                desc_candidate = re.sub(r'\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}', '', desc_candidate)
                desc_candidate = desc_candidate.strip()
                if desc_candidate and any(c.isalpha() for c in desc_candidate) and len(desc_candidate) > 2:
                    if not (re.search(r'\d+:\d{2}:\d{2}', desc_candidate) and ('Dani' in desc_candidate or 'Alberto' in desc_candidate)):
                        desc_parts.append(desc_candidate)
    
    # Check if description is in the same line (before duration)
    if dur_match:
        before_duration = main_line[:dur_match.start()].strip()
        if before_duration:
            # Clean up
            before_duration = re.sub(r'\b(Dani|Alberto|Joan|Jordi)\b', '', before_duration)
            before_duration = re.sub(r'•.*', '', before_duration)
            before_duration = re.sub(r'\s*-\s*$', '', before_duration)
            before_duration = before_duration.strip()
            
            if before_duration and len(before_duration) > 2 and any(c.isalpha() for c in before_duration):
                skip_patterns = ['DESCRIPTION', 'DURATION', 'All time entries', 'Detailed report']
                if not any(pattern in before_duration for pattern in skip_patterns):
                    # Don't duplicate
                    if not any(before_duration.lower() in part.lower() or part.lower() in before_duration.lower() for part in desc_parts):
                        desc_parts.insert(0, before_duration)  # Put at beginning as primary description
    
    # Combine description
    description = ' '.join(desc_parts).strip() if desc_parts else None
    
    # Clean up description
    if description:
        description = ' '.join(description.split())  # Remove extra spaces
        # Remove common suffixes
        description = re.sub(r'\s+\d{2}/\d{2}/\d{4}.*$', '', description)
        description = description.strip()
    
    # Fallback
    if not description or len(description) < 3:
        description = project
    
    # Look for time - check previous line first
    start_time = ''
    end_time = ''
    time_pattern = r'(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})'
    
    # Check previous line
    if start_idx > 0:
        prev_line = clean_text(lines[start_idx - 1])
        time_match = re.search(time_pattern, prev_line)
        if time_match:
            start_time = f"{time_match.group(1)}:{time_match.group(2)}"
            end_time = f"{time_match.group(3)}:{time_match.group(4)}"
    
    # Check main line
    if not start_time:
        time_match = re.search(time_pattern, main_line)
        if time_match:
            start_time = f"{time_match.group(1)}:{time_match.group(2)}"
            end_time = f"{time_match.group(3)}:{time_match.group(4)}"
    
    # Default times
    if not start_time:
        start_time = '00:01'
    if not end_time:
        end_time = '00:01'
    
    # Find project and date - look forward
    date = ''
    project_found = project
    
    # Look in next few lines for date and project (expanded range)
    for j in range(start_idx + 1, min(start_idx + 8, len(lines))):
        line = clean_text(lines[j])
        if not line or line == '•':
            continue
        
        # Check for project marker
        project_match = re.search(r'•\s*([^-]+?)(?:\s+\d{2}/\d{2}/\d{4})', line)
        if project_match:
            project_found = project_match.group(1).strip()
        
        # Check for date
        date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', line)
        if date_match:
            month = date_match.group(1)
            day = date_match.group(2)
            year = date_match.group(3)
            date = f"{year}-{month}-{day}"
            break
    
    # Look backward for date if not found (expanded range)
    if not date:
        for j in range(start_idx - 1, max(-1, start_idx - 5), -1):
            line = clean_text(lines[j])
            if not line:
                continue
            date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', line)
            if date_match:
                month = date_match.group(1)
                day = date_match.group(2)
                year = date_match.group(3)
                date = f"{year}-{month}-{day}"
                
                # Also check for project here
                if '•' in line:
                    project_match = re.search(r'•\s*([^-]+?)(?:\s+\d{2}/\d{2}/\d{4})', line)
                    if project_match:
                        project_found = project_match.group(1).strip()
                break
    
    # If still no date found, try to find the closest date in the entire document context
    # This is a fallback to ensure we don't lose entries
    if not date:
        # Look in a wider range
        for j in range(max(0, start_idx - 10), min(len(lines), start_idx + 10)):
            line = clean_text(lines[j])
            date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', line)
            if date_match:
                month = date_match.group(1)
                day = date_match.group(2)
                year = date_match.group(3)
                date = f"{year}-{month}-{day}"
                break
    
    # Last resort: if still no date, skip this entry
    if not date:
        return None
    
    return {
        'description': description,
        'duration': duration,
        'member': member,
        'project': project_found if project_found else project,
        'date': date,
        'start_time': start_time,
        'end_time': end_time,
        'tags': ''
    }

if __name__ == '__main__':
    pdf_path = 'reportes_csv/intek-medical-final.pdf'
    output_path = 'reportes_csv/intek_medical_final_data.csv'
    
    print(f"Extracting from {pdf_path}...")
    with pdfplumber.open(pdf_path) as pdf:
        text_lines = []
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_lines.extend(page_text.split('\n'))
    
    print(f"Total lines extracted: {len(text_lines)}")
    
    entries = parse_entries(text_lines)
    
    print(f"\nFound {len(entries)} entries")
    
    # Calculate total
    def time_to_hours(duration):
        if not duration:
            return 0
        parts = duration.split(':')
        if len(parts) == 3:
            h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
            return h + m/60 + s/3600
        return 0
    
    total_hours = sum(time_to_hours(e.get('duration', '')) for e in entries)
    total_seconds = sum(
        int(e.get('duration', '0:0:0').split(':')[0]) * 3600 + 
        int(e.get('duration', '0:0:0').split(':')[1]) * 60 + 
        int(e.get('duration', '0:0:0').split(':')[2])
        for e in entries
    )
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    
    # Group by description to see unique tasks
    desc_groups = {}
    for entry in entries:
        desc = entry.get('description', '').strip()
        key = desc.lower()
        if key not in desc_groups:
            desc_groups[key] = {'desc': desc, 'entries': [], 'total_hours': 0}
        desc_groups[key]['entries'].append(entry)
        desc_groups[key]['total_hours'] += time_to_hours(entry.get('duration', ''))
    
    # Members
    members = {}
    for entry in entries:
        m = entry.get('member', '')
        members[m] = members.get(m, 0) + 1
    
    print(f"\n✅ Total: {hours:02d}:{minutes:02d}:{seconds:02d} ({total_hours:.2f}h)")
    print(f"✅ Members: {dict(sorted(members.items()))}")
    print(f"✅ Unique descriptions: {len(desc_groups)}")
    print(f"\nTop 10 task descriptions:")
    for key, data in sorted(desc_groups.items(), key=lambda x: x[1]['total_hours'], reverse=True)[:10]:
        print(f"  - \"{data['desc'][:60]}\": {len(data['entries'])} entries, {data['total_hours']:.2f}h")
    
    # Save CSV
    header = ['Description', 'Duration (HH:MM:SS)', 'Member', 'Project', 'Date', 'Start Time', 'End Time', 'Tags']
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for entry in entries:
            normalized_duration = normalize_duration(entry.get('duration', ''))
            writer.writerow([
                entry.get('description', ''),
                normalized_duration,
                entry.get('member', ''),
                entry.get('project', ''),
                entry.get('date', ''),
                entry.get('start_time', ''),
                entry.get('end_time', ''),
                entry.get('tags', '')
            ])
    
    print(f"\n✅ Saved to {output_path}")




