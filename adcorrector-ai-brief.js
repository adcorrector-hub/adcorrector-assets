/**
 * Ad Corrector - Actionable Insights Module
 * FINAL PRODUCTION VERSION - Connected to AdCorrector Engine
 */

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
            // Check if AdCorrector exists and has the new function
            if (!window.AdCorrector || typeof window.AdCorrector.getAnalysisData !== 'function') {
                throw new Error("The Ad Corrector engine is still warming up. Please wait a moment or ensure you've uploaded an image.");
            }

            const rawData = window.AdCorrector.getAnalysisData();
            
            if (!rawData || Object.keys(rawData).length === 0) {
                throw new Error("No analysis data found. Please upload an ad and run the tool first.");
            }

            const simplifiedData = {
                clutterScore: rawData.clutterPercent + "%",
                detectedText: rawData.ocrText || "No text detected",
                colorPalette: rawData.palette ? rawData.palette.join(', ') : "Unknown",
                brightness: rawData.brightnessScore || "Normal",
                speedViewRating: rawData.clutterPercent > 60 ? "Poor (High Clutter)" : "Good"
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an elite Out-of-Home (OOH) advertising strategist. 
                            Analyze this specific ad physics data gathered from a visibility tool: ${JSON.stringify(simplifiedData)}. 
                            
                            Provide a "Fix-It Brief" for the advertiser with these 3 sections: 
                            1. Speed-View Analysis (Based on clutter and text)
                            2. Color & Heatmap Insight (Based on brightness and palette)
                            3. Top 3 Immediate Design Fixes. 
                            
                            Format the response in clean HTML using <h3> headers and bullet points. 
                            Keep it professional, direct, and actionable. Do not include intro or outro text.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }

            let htmlContent = data.candidates[0].content.parts[0].text;
            htmlContent = htmlContent.replace(/```html|```/g, ''); // Clean markdown if present
            
            resultsContainer.innerHTML = htmlContent;

        } catch (error) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; color: #be123c; background: #fff1f2; border-radius: 8px; border: 1px solid #fda4af;">
                    <h3 style="margin-top:0">Synthesis Paused</h3>
                    <p>${error.message}</p>
                    <p style="font-size: 12px;">Ensure you have uploaded an image and the Ad Corrector analysis is complete before generating a brief.</p>
                </div>`;
            console.error('AI Brief Error:', error);
        } finally {
            loader.style.display = 'none';
        }
    }
};

// Start the module with a slight delay for Tilda compatibility
setTimeout(initAI, 500);

