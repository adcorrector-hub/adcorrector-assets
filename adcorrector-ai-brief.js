/**
 * Ad Corrector - AI Brief
 * FINAL PRODUCTION VERSION - 100% Correct
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    // THE CLICK EVENT
    triggerBtn.onclick = async function() {
        // 1. Force the modal open immediately
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        // 2. Grab the Key from the window (Tilda Block)
        const apiKey = window.GEMINI_API_KEY;

        if (!apiKey || apiKey === "YOUR_ACTUAL_API_KEY_HERE") {
            loader.style.display = 'none';
            resultsContainer.innerHTML = "<p style='color:red;'><b>Configuration Error:</b> API Key not found. Please check your Tilda HTML block.</p>";
            return;
        }

        try {
            // 3. THE LIVE SCRAPE (Grabbing data from your main tool)
            const clutter = document.querySelector('.ac-clutter-value')?.innerText || "0%";
            const headline = document.getElementById('ac-headlineText')?.value || "Not provided";
            const cta = document.getElementById('ac-ctaText')?.value || "Not provided";

            // 4. THE API CALL
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this ad data: Clutter: ${clutter}, Headline: "${headline}", CTA: "${cta}". 
                            Provide a Fix-It Brief in HTML format with <h3> headers: 
                            1. Speed-View Analysis 
                            2. 3 Specific Design Fixes. 
                            Keep it direct and professional. Do not include intro/outro text.` 
                        }]
                    }]
                })
            });

            const data = await response.json();

            // 5. ERROR HANDLING
            if (data.error) {
                throw new Error(data.error.message);
            }

            // 6. RENDER RESULTS
            loader.style.display = 'none';
            let htmlContent = data.candidates[0].content.parts[0].text;
            // Remove markdown code blocks if AI includes them
            resultsContainer.innerHTML = htmlContent.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = `
                <div style="color: #991b1b; background: #fef2f2; padding: 15px; border-radius: 8px;">
                    <strong>API Connection Error:</strong><br>
                    ${err.message}
                </div>`;
        }
    };

    // CLOSE LOGIC
    const closeModal = () => { modal.style.display = 'none'; };
    document.getElementById('ac-modal-close').onclick = closeModal;
    document.getElementById('ac-modal-backdrop').onclick = closeModal;
};

// Initialize with a safety delay
setTimeout(initAI, 1000);
