import easyocr

# Initialize reader
reader = easyocr.Reader(['en'])  # 'en' for English

def ocrimage(image_path):
    # Read the image using EasyOCR
    results = reader.readtext(image_path)
    
    # Extract text from results
    textlist = []
    for (bbox, text, prob) in results:
        textlist.append(text.strip())
    
    # Join the list into a single string
    extracted_text = ' '.join(textlist)
    
    if extracted_text:
        return extracted_text
    else:
        return None