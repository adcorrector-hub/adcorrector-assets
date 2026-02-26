/**
 * Ad Corrector - AI Brief
 * VERSION: ADC 2.23.26 SYNCED
 */

const initAI = () => {
    const triggerBtn = document.getElementById('ac-ai-brief-trigger');
    const modal = document.getElementById('ac-ai-modal');
    const resultsContainer = document.getElementById('ac-results');
    const loader = document.getElementById('ac-loader');

    if (!triggerBtn || !modal) return;

    triggerBtn.onclick = async function() {
        // 1. UI Setup
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        loader.style.display = 'block';
        resultsContainer.innerHTML = '';

        // 2. Data Sync (Matched to ADC Engine IDs)
        const apiKey = window.GEMINI_API_KEY;
        
        // Pulling from your ADC result spans and input fields
        const score = document.querySelector('.ac-clutter-value')?.innerText || "Pending";
        const grade = document.querySelector('.ac-grade-value')?.innerText || "";
        const headline = document.getElementById('ac-headlineText')?.value || "None";
        const cta = document.getElementById('ac-ctaText')?.value || "None";

        try {
            // 3. The API Handshake (v1 Stable)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ 
                            text: `Act as an OOH expert. Analyze this ADC result:
                            Score: ${score} ${grade}
                            Headline: "${headline}"
                            CTA: "${cta}"
                            
                            Write a "Fix-It Brief" in HTML format with <h3> headers:
                            1. Analysis (Why this score was achieved)
                            2. Design Fixes (3 actionable ways to improve visibility/speed-view)
                            Keep it direct and professional. Use bullets.` 
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            // 4. Render & Clean
            loader.style.display = 'none';
            let content = data.candidates[0].content.parts[0].text;
            resultsContainer.innerHTML = content.replace(/```html|```/g, '');

        } catch (err) {
            loader.style.display = 'none';
            resultsContainer.innerHTML = `<div style="color:#991b1b; background:#fef2f2; padding:15px; border-radius:8px;"><strong>Status:</strong> ${err.message}</div>`;
        }
    };

    // Modal Close Logic
    const closeModal = () => { modal.style.display = 'none'; modal.classList.remove('is-open'); };
    document.getElementById('ac-modal-close').onclick = closeModal;
    document.getElementById('ac-modal-backdrop').onclick = closeModal;
};

// Initialize
setTimeout(initAI, 1000);
