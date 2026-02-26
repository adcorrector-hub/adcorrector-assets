/**
 * Ad Corrector - AI Brief
 * THE FAIL-SAFE VERSION
 */

const initAI = () => {
    const btn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const results = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!btn || !modal) return;

    btn.onclick = async function() {
        // 1. IMMEDIATELY show the modal so we know it works
        modal.style.display = 'flex';
        loader.style.display = 'block';
        results.innerHTML = "";

        try {
            // 2. SCRAPE DATA (Looking for the specific names in your JS file)
            const clutter = document.querySelector('.ac-clutter-value')?.innerText || "Not Calculated";
            const headline = document.getElementById('ac-headlineText')?.value || "Not Entered";
            const cta = document.getElementById('ac-ctaText')?.value || "Not Entered";
            
            const key = window.GEMINI_API_KEY;

            // 3. TALK TO GOOGLE
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `OOH Expert: Analyze this ad. Speed-View/Clutter: ${clutter}. Headline: "${headline}". CTA: "${cta}". Provide a 3-point fix-it plan in simple HTML.` 
                        }]
                    }]
                })
            });

            const data = await response.json();
            loader.style.display = 'none';
            results.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            results.innerHTML = `<p style="color:red"><b>Connection Issue:</b> ${err.message}</p>`;
        }
    };

    // Close Button Logic
    document.getElementById('ac-modal-close').onclick = () => { modal.style.display = 'none'; };
};

// Start the script
setTimeout(initAI, 1000);
