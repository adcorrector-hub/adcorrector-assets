/**
 * Ad Corrector - Actionable Insights Module
 * Final Version: Physics Data Handshake + Secure API
 */

// 1. Grab the key from the Tilda window
const GEMINI_API_KEY = window.GEMINI_API_KEY;

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const closeBtn = document.getElementById('ac-modal-close');
    const backdrop = document.getElementById('ac-modal-backdrop');
    const loader = document.getElementById('ac-loader');
    const resultsContainer = document.getElementById('ac-results');

    if (!triggerBtn || !modal) return;

    const openModal = () => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; 
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; 
    };

    triggerBtn.addEventListener('click', () => {
        openModal();
        generateInsights();
    });

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    async function generateInsights() {
        loader.style.display = 'flex';
        resultsContainer.innerHTML = '';

        try {
            // THE HANDSHAKE: Pulling live data from your main Ad Corrector engine
            const adData = {
                speedView: window.currentSpeedView || "Not calculated yet",
                clutterScore: window.currentClutterScore || "Not calculated yet",
                legibility: window.currentLegibilityScore || "Not calculated yet",
                fontThickness: window.currentFontWeight || "Standard"
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite Out-of-Home (OOH) advertising strategist. 
                            Analyze this specific ad physics data: ${JSON.stringify(adData)}. 
                            Provide a "Fix-It Brief" with 3 clear sections: 
                            1. Speed-View Analysis 
                            2. Heatmap/Clutter Insight 
                            3. Top 3 Design Fixes. 
                            Format the response in clean HTML using <h3> headers and bullet points. 
                            Do not include any intro or outro text.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            
            // Cleanup: remove markdown markers if the AI includes them
            let htmlContent = data.candidates[0].content.parts[0].text;
            htmlContent = htmlContent.replace(/```html|```/g, '');
            
            resultsContainer.innerHTML = htmlContent;

        } catch (error) {
            resultsContainer.innerHTML = "<p style='color:red;'>Error generating brief. Please ensure the Ad Corrector tool has finished its analysis first.</p>";
            console.error(error);
        } finally {
            loader.style.display = 'none';
        }
    }
};

// Run after half a second to let Tilda finish loading the button
setTimeout(initAI, 500);
