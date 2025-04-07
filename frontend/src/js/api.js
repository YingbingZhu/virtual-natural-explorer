export async function fetchQuiz() {
    const response = await fetch("https://opentdb.com/api.php?amount=5&category=27&type=multiple");
    const data = await response.json();
    return data.results;
}