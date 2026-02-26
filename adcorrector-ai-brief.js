/**
 * Ad Corrector - AI Brief
 * VERSION: UNIVERSAL MODEL COMPATIBILITY
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        const apiKey = window.GEMINI_API_KEY;

        if (!apiKey) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = "<p style='color:red;'><b>Error:</b> API Key missing from Tilda.</p>";
            return;
        }

        try {
            const clutter = document.querySelector('.ac-clutter-value')?.innerText || "0%";
            const headline = document.getElementById('ac-headlineText')?.value || "Not provided";
            const cta = document.getElementById('ac-ctaText')?.value || "Not provided";

            // UPDATED URL: Using gemini-1.5-flash-latest for maximum key compatibility
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this: Clutter ${clutter}, Headline "${headline}", CTA "${cta}". 
                            Provide a Fix-It Brief in HTML with <h3> headers. 1. Analysis, 2. Design Fixes.` 
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) {
                // This will tell us if the model name is STILL an issue
                throw new Error(data.error.message);
            }

            loader.style.display = 'none';
            let htmlContent = data.candidates[0].content.parts[0].text;
            resultsContainer.innerHTML = htmlContent.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = `<div style="color:#991b1b; background:#fef2f2; padding:15px; border-radius:8px;"><strong>API Error:</strong><br>${err.message}</div>`;
        }
    };

    const closeModal = () => { modal.style.display = 'none'; };
    document.getElementById('ac-modal-close').onclick = closeModal;
    document.getElementById('ac-modal-backdrop').onclick = closeModal;
};

setTimeout(initAI, 1000);
