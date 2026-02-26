/**
 * Ad Corrector - AI Brief
 * THE NUCLEAR OPTION (Universal Text Search)
 */

const GEMINI_API_KEY = window.GEMINI_API_KEY;

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async () => {
        modal.classList.add('is-open');
        loader.style.display = 'flex';
        resultsContainer.innerHTML = '';

        try {
            // 1. THE SEARCH: Look for Clutter Score anywhere on the page
            const pageText = document.body.innerText;
            const clutterMatch = pageText.match(/Clutter\s*Score[:\s]*(\d+)%/i);
            const clutterScore = clutterMatch ? clutterMatch[1] + "%" : null;

            // 2. GRAB TEXT: Look for the input fields
            const headline = document.querySelector('[id*="headlineText"]')?.value || "Not found";
            const cta = document.querySelector('[id*="ctaText"]')?.value || "Not found";

            // 3. DEBUGGER: If it's still 0% or null, we show exactly what the script found
            if (!clutterScore || clutterScore === "0%") {
                throw new Error(`Data not synced. Found: Clutter(${clutterScore}), Headline(${headline})`);
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `OOH Expert Analysis: Clutter is ${clutterScore}, Headline is "${headline}", CTA is "${cta}". Write a 3-step design fix brief in HTML.` }]
                    }]
                })
            });

            const data = await response.json();
            resultsContainer.innerHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');

        } catch (error) {
            resultsContainer.innerHTML = `<div style="padding:20px; color:#be123c;"><h3>Handshake Issue</h3><p>${error.message}</p><p>Tip: Make sure the Clutter Score is showing a number on your screen before clicking.</p></div>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    // Close logic
    document.getElementById('ac-modal-close').onclick = () => modal.classList.remove('is-open');
};

setTimeout(initAI, 1000);
