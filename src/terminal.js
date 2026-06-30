const output = document.getElementById("terminal-output");

export function clearTerminal() {
    output.innerHTML = "";
    output.style.display = "block";
}

export function terminal(message) {
    output.style.display = "block";
    output.innerHTML += `${message}<br>`;
}