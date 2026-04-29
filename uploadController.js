const Tesseract = require('tesseract.js');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const Claim = require('./Claim');
const { fromPath } = require('pdf2pic');
const fs = require('fs');
const logger = require('./logger');

const runPythonScript = (scriptPath, inputData) => {
    return new Promise((resolve, reject) => {
        let pythonCommand = 'C:\\Program Files\\Python313\\python.exe';
        const pythonProcess = spawn(pythonCommand, [scriptPath]);

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

        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();
    });
};

exports.processClaim = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let filePath = req.file.path;
        logger.info(`Processing file: ${filePath}`);

        if (req.file.mimetype === 'application/pdf') {
            logger.info('PDF detected, converting first page to image...');
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
            logger.info(`PDF converted to image: ${filePath}`);
        }

        logger.info('Starting OCR...');
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        logger.info('OCR Complete.');

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

        const predictScriptPath = path.join(__dirname, 'predict.py');
        const nlpScriptPath = path.join(__dirname, 'nlp_extract.py');

        try {
            const nlpResult = await runPythonScript(nlpScriptPath, text);

            features.has_doctor_name = nlpResult.doctorName ? 1 : 0;
            features.has_patient_name = nlpResult.patientName ? 1 : 0;
            features.diagnosis_keyword_count = nlpResult.diagnosisKeywords ? nlpResult.diagnosisKeywords.length : 0;
            features.has_date = nlpResult.dateOfTreatment ? 1 : 0;

            const predictResult = await runPythonScript(predictScriptPath, JSON.stringify(features));

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
            logger.error(`Python Script Error: ${scriptError.message}`);
            return res.status(500).json({ success: false, message: 'Python Processing Error', error: scriptError.message });
        }

    } catch (error) {
        logger.error(`Upload process error: ${error.message}`);
        res.status(500).json({ success: false, message: "Server processing error." });
    }
};
