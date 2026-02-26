/**
 * Ad Corrector - AI Brief
 * VERSION: MATCHED TO YOUR ENGINE LABELS
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const results = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        modal.style.display = 'flex';
        loader.style.display = 'block';
        results.innerHTML = "";

        try {
            /** * THE DATA SEARCH:
             * We are looking for the "Speed-View Score" (your clutter metric)
             * and your Headline/CTA inputs.
             */
            const clutterValue = document.querySelector('.ac-clutter-value')?.innerText || "0%";
            const headline = document.getElementById('ac-headlineText')?.value || "Not set";
            const cta = document.getElementById('ac-ctaText')?.value || "Not set";
            
            const apiKey = window.GEMINI_API_KEY;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this ad data: 
                            - Speed-View Score: ${clutterValue}
                            - Headline: ${headline}
                            - CTA: ${cta}
                            
                            Give a Fix-It Brief in HTML format with <h3> headers:
                            1. Analysis 
                            2. 3 Design Fixes.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            loader.style.display = 'none';
            results.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            results.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        }
    };

    const closeMe = () => { modal.style.display = 'none'; };
    document.getElementById('ac-modal-close').onclick = closeMe;
    document.getElementById('ac-modal-backdrop').onclick = closeMe;
};

setTimeout(initAI, 1000);
