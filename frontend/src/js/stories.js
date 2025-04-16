/**
 * tab switching
 */
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});
  
/**
 * Story generator calling proxy API to fetch AI response
 */
document.getElementById("generate-story").addEventListener("click", async () => {
  const continent = document.getElementById("story-continent").value;
  const animal = document.getElementById("story-animal").value.trim();
  const name = document.getElementById("story-name").value.trim();
  const output = document.getElementById("story-output");

  if (!animal || !name) {
    output.innerHTML = "<p>📝 Please enter both an animal and a name!</p>";
    return;
  }

  output.innerHTML = "⏳ Generating your story...";

  const prompt = `Write a short story (150 words) for kids about a character named ${name} who meets a ${animal} in ${continent}. Include 1–2 real facts. Make it friendly and magical.`;

  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    output.innerHTML = `<p>${data.choices[0].message.content.replace(/\n/g, "<br>")}</p>`;
  } catch (err) {
    output.innerHTML = "<p>❌ Failed to generate story. Try again.</p>";
    console.error(err);
  }
});
