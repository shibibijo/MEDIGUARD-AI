const Tesseract = require('tesseract.js');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const Claim = require('../models/Claim');
const { fromPath } = require('pdf2pic');
const fs = require('fs');

const runPythonScript = (scriptPath, args) => {
    return new Promise((resolve, reject) => {
        let pythonCommand = 'python';
        const python3Check = spawnSync('python3', ['--version']);
        if (!python3Check.error) {
            pythonCommand = 'python3';
        }

        const pythonProcess = spawn(pythonCommand, [scriptPath, ...args]);
        
        let returnData = '';
        let returnError = '';

        pythonProcess.stdout.on('data', (data) => {
            returnData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            returnError += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(returnError || `Python script exited with code ${code}`));
            } else {
                try {
                    const result = JSON.parse(returnData);
                    if (result.error) {
                        reject(new Error(result.error));
                    } else {
                        resolve(result);
                    }
                } catch (err) {
                    reject(new Error('Error parsing Python script output'));
                }
            }
        });
        
        pythonProcess.on('error', (err) => {
            reject(err);
        });
    });
};

exports.processClaim = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let filePath = req.file.path;
        console.log(`Processing file: ${filePath}`);

        if (req.file.mimetype === 'application/pdf') {
            console.log('PDF detected, converting first page to image...');
            const uploadDir = path.dirname(filePath);
            const baseName = path.basename(filePath, path.extname(filePath));
            
            const options = {
                density: 300,
                saveFilename: baseName,
                savePath: uploadDir,
                format: "png",
                width: 2480,
                height: 3508
            };
            
            const convert = fromPath(filePath, options);
            const pageToConvertAsImage = 1;
            
            const resolveObj = await convert(pageToConvertAsImage, { responseType: "image" });
            filePath = resolveObj.path;
            console.log(`PDF converted to image: ${filePath}`);
        }

        console.log('Starting OCR...');
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        console.log('OCR Complete.');

        const textLower = text.toLowerCase();
        const textLength = text.length;

        let hasCriticalKeywords = 0;
        const criticalWords = ['surgery', 'emergency', 'icu', 'critical', 'trauma', 'operation'];
        for (const word of criticalWords) {
            if (textLower.includes(word)) {
                hasCriticalKeywords = 1;
                break;
            }
        }

        let hasFraudKeywords = 0;
        const fraudWords = ['altered', 'fake', 'rewrite', 'photoshop', 'duplicate'];
        for (const word of fraudWords) {
            if (textLower.includes(word)) {
                hasFraudKeywords = 1;
                break;
            }
        }

        const amountMatch = text.match(/(?:₹|Rs\.?|\$)?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i);
        let amountMentioned = 5000;
        if (amountMatch && amountMatch[1]) {
            amountMentioned = parseFloat(amountMatch[1].replace(/,/g, ''));
        }

        const features = {
            text_length: textLength,
            has_critical_keywords: hasCriticalKeywords,
            has_fraud_keywords: hasFraudKeywords,
            amount_mentioned: amountMentioned
        };

        const predictScriptPath = path.join(__dirname, '../../ml-model/predict.py');
        const nlpScriptPath = path.join(__dirname, '../../ml-model/nlp_extract.py');

        try {
            const [predictResult, nlpResult] = await Promise.all([
                runPythonScript(predictScriptPath, [JSON.stringify(features)]),
                runPythonScript(nlpScriptPath, [text])
            ]);

            let decision = 'Approved';
            let rejectionReason = '';

            if (predictResult.fraud === 1) {
                decision = 'Rejected';
                if (features.has_fraud_keywords) {
                    rejectionReason = "Suspicious document alteration keywords detected.";
                } else if (features.text_length < 300) {
                    rejectionReason = "Claim document lacks sufficient details or looks incomplete.";
                } else {
                    rejectionReason = "System detected an irregular pattern corresponding to a potential fraud attempt.";
                }
            } else if (predictResult.probability > 0.4 && predictResult.probability < 0.5) {
                decision = 'Requires Manual Review';
                rejectionReason = "Borderline suspicion score.";
            }

            const newClaim = new Claim({
                filename: req.file.originalname,
                extractedText: text,
                fraud: predictResult.fraud,
                probability: predictResult.probability,
                decision: decision,
                rejectionReason: rejectionReason,
                patientName: nlpResult.patientName || "",
                doctorName: nlpResult.doctorName || "",
                dateOfTreatment: nlpResult.dateOfTreatment || "",
                diagnosisKeywords: nlpResult.diagnosisKeywords || []
            });
            await newClaim.save();

            res.json({
                success: true,
                data: {
                    decision: decision,
                    probability: (predictResult.probability * 100).toFixed(2),
                    reason: rejectionReason,
                    features: features,
                    nlpEntities: {
                        patientName: nlpResult.patientName,
                        doctorName: nlpResult.doctorName,
                        dateOfTreatment: nlpResult.dateOfTreatment,
                        diagnosisKeywords: nlpResult.diagnosisKeywords
                    }
                }
            });

        } catch (scriptError) {
            console.error("Python Script Error:", scriptError);
            return res.status(500).json({ success: false, message: 'Python Processing Error', error: scriptError.message });
        }

    } catch (error) {
        console.error("Upload process error:", error);
        res.status(500).json({ success: false, message: "Server processing error." });
    }
};
