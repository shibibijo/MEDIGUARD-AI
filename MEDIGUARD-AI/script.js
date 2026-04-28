document.addEventListener('DOMContentLoaded', () => {

    const loginOverlay = document.getElementById('loginOverlay');
    const mainContent = document.getElementById('mainContent');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const userRoleBadge = document.getElementById('userRoleBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    // Check Auth State
    checkAuth();

    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (token && user) {
            showMainApp(user);
        } else {
            showLogin();
        }
    }

    function showMainApp(user) {
        loginOverlay.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userRoleBadge.textContent = user.role.toUpperCase();
        initAnimations();
    }

    function showLogin() {
        loginOverlay.classList.remove('hidden');
        mainContent.classList.add('hidden');
        loginForm.reset();
        loginError.classList.add('hidden');
    }

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        loginBtn.disabled = true;
        loginBtn.querySelector('.spinner').classList.remove('hidden');
        loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                showMainApp(data.user);
            } else {
                loginError.textContent = data.message || 'Invalid credentials';
                loginError.classList.remove('hidden');
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                loginError.textContent = 'Network error: Server is unreachable.';
            } else {
                loginError.textContent = 'Server error. Please try again.';
            }
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
            loginBtn.querySelector('.spinner').classList.add('hidden');
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showLogin();
    });

    let animationsInitialized = false;
    function initAnimations() {
        if (animationsInitialized) return;
        animationsInitialized = true;

        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
            gsap.to("#bg-steth", {
                yPercent: -15,
                ease: "none",
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: "bottom bottom",
                    scrub: true
                }
            });
            gsap.from(".feature-card", {
                y: 50,
                opacity: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: "#features",
                    start: "top 80%"
                }
            });
        }
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.9)';
                navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.7)';
                navbar.style.boxShadow = 'none';
            }
        }
    });

    // Claim Upload Functionality
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('claimDocument');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const checkBtn = document.getElementById('checkBtn');
    const btnText = checkBtn.querySelector('span');
    const spinner = checkBtn.querySelector('.spinner');
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    const uploadError = document.getElementById('uploadError');

    const resultCard = document.getElementById('resultCard');
    const statusIcon = document.getElementById('statusIcon');
    const decisionText = document.getElementById('decisionText');
    const probText = document.getElementById('probText');
    const reasonContainer = document.getElementById('reasonContainer');
    const reasonText = document.getElementById('reasonText');

    // NLP Elements
    const nlpPatientRow = document.getElementById('nlpPatientRow');
    const nlpPatient = document.getElementById('nlpPatient');
    const nlpDoctorRow = document.getElementById('nlpDoctorRow');
    const nlpDoctor = document.getElementById('nlpDoctor');
    const nlpDateRow = document.getElementById('nlpDateRow');
    const nlpDate = document.getElementById('nlpDate');
    const nlpDiagnosisRow = document.getElementById('nlpDiagnosisRow');
    const nlpDiagnosis = document.getElementById('nlpDiagnosis');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (fileInputWrapper) fileInputWrapper.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        if (fileInputWrapper) fileInputWrapper.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        if (fileInputWrapper) fileInputWrapper.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileInputWrapper.classList.add('drag-active');
    }

    function unhighlight(e) {
        fileInputWrapper.classList.remove('drag-active');
    }

    if (fileInputWrapper) {
        fileInputWrapper.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileNameDisplay.textContent = e.target.files[0].name;
                resultCard.classList.add('hidden');
                resultCard.classList.remove('approved', 'rejected');
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (fileInput.files.length === 0) {
                alert('Please select a file first.');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                alert('Authentication required. Please login again.');
                showLogin();
                return;
            }

            const formData = new FormData();
            formData.append('claimDocument', fileInput.files[0]);

            checkBtn.disabled = true;
            btnText.textContent = 'Processing Claim...';
            spinner.classList.remove('hidden');
            resultCard.classList.add('hidden');
            resultCard.classList.remove('approved', 'rejected');
            if (uploadError) uploadError.classList.add('hidden');

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json().catch(() => null);

                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    showLogin();
                    throw new Error('Session expired. Please login again.');
                }

                if (!response.ok) {
                    throw new Error((data && data.message) ? data.message : 'Server error occurred');
                }

                displayResult(data.data);

            } catch (error) {
                console.error('Error:', error);
                let errorMsg = error.message || 'An error occurred while processing the claim.';
                if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                    errorMsg = 'Network error: Server is unreachable. Please try again later.';
                }

                if (uploadError) {
                    uploadError.textContent = errorMsg;
                    uploadError.classList.remove('hidden');
                } else {
                    alert(errorMsg);
                }
            } finally {
                checkBtn.disabled = false;
                btnText.textContent = 'Check Claim';
                spinner.classList.add('hidden');
            }
        });
    }

    function displayResult(data) {
        resultCard.classList.remove('hidden');
        resultCard.style.animation = 'none';
        void resultCard.offsetWidth;
        resultCard.style.animation = null;

        probText.textContent = `${data.probability}%`;

        if (data.decision === 'Approved') {
            resultCard.classList.add('approved');
            statusIcon.innerHTML = '✅';
            decisionText.textContent = 'Claim Approved';
            probText.className = 'prob-low';
            reasonContainer.classList.add('hidden');
        } else {
            resultCard.classList.add('rejected');
            statusIcon.innerHTML = '❌';
            decisionText.textContent = 'Claim Rejected';
            probText.className = 'prob-high';

            if (data.reason) {
                reasonText.textContent = data.reason;
                reasonContainer.classList.remove('hidden');
            } else {
                reasonContainer.classList.add('hidden');
            }
        }

        // Show NLP Extracted Data if present
        const nlp = data.nlpEntities || {};

        if (nlp.patientName) {
            nlpPatient.textContent = nlp.patientName;
            nlpPatientRow.classList.remove('hidden');
        } else {
            nlpPatientRow.classList.add('hidden');
        }

        if (nlp.doctorName) {
            nlpDoctor.textContent = nlp.doctorName;
            nlpDoctorRow.classList.remove('hidden');
        } else {
            nlpDoctorRow.classList.add('hidden');
        }

        if (nlp.dateOfTreatment) {
            nlpDate.textContent = nlp.dateOfTreatment;
            nlpDateRow.classList.remove('hidden');
        } else {
            nlpDateRow.classList.add('hidden');
        }

        if (nlp.diagnosisKeywords && nlp.diagnosisKeywords.length > 0) {
            nlpDiagnosis.textContent = nlp.diagnosisKeywords.join(', ');
            nlpDiagnosisRow.classList.remove('hidden');
        } else {
            nlpDiagnosisRow.classList.add('hidden');
        }

        setTimeout(() => {
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
});
