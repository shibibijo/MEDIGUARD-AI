import sys
import json
import re
import nltk
from nltk.tokenize import word_tokenize
from nltk.tag import pos_tag
from nltk.chunk import ne_chunk


def ensure_nltk_data():
    packages = [
        'punkt',
        'punkt_tab',
        'averaged_perceptron_tagger',
        'averaged_perceptron_tagger_eng',
        'maxent_ne_chunker',
        'words'
    ]
    for package in packages:
        try:
            nltk.download(package, quiet=True)
        except Exception:
            pass


def extract_entities(text):
    ensure_nltk_data()

    tokens = word_tokenize(text)
    pos_tags = pos_tag(tokens)
    chunks = ne_chunk(pos_tags)

    patient_name = ""
    doctor_name = ""
    diagnosis_keywords = []

    for chunk in chunks:
        if hasattr(chunk, 'label'):
            if chunk.label() == 'PERSON':
                person_name = ' '.join(c[0] for c in chunk)
                if not patient_name:
                    patient_name = person_name

    doc_match = re.search(r'(?:Dr\.|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', text)
    if doc_match:
        doctor_name = doc_match.group(1)
        if patient_name == doctor_name:
            patient_name = ""

    diag_match = re.search(r'diagnosis[:\s]+([a-zA-Z0-9,\-]+)', text, re.IGNORECASE)
    if diag_match:
        diag_text = diag_match.group(1)
        diag_tokens = word_tokenize(diag_text)
        diag_tags = pos_tag(diag_tokens)
        diagnosis_keywords = [word for word, tag in diag_tags if tag.startswith('NN')]

    if not diagnosis_keywords:
        diagnosis_keywords = [word for word, tag in pos_tags if tag.startswith('NN') and len(word) > 4][:5]

    date_of_treatment = ""
    date_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text)
    if date_match:
        date_of_treatment = date_match.group(1)

    return {
        "patientName": patient_name,
        "doctorName": doctor_name,
        "dateOfTreatment": date_of_treatment,
        "diagnosisKeywords": diagnosis_keywords
    }


def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No text provided"}))
            sys.exit(1)

        text = sys.argv[1]
        result = extract_entities(text)

        print(json.dumps(result))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()