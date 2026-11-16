const chatform = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

const messages = [];

function addMessage(text, sender) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const content = document.createElement("div");
    content.classList.add("message-content");
    content.textContent = text;

    message.appendChild(content);
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;

    return content;
}

chatform.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) {
        return;
    }

    // ========================
    // Tampilkan pesan user
    // ========================
    addMessage(message, "user");

    // Simpan pesan user
    messages.push({
        role: "user",
        content: message
    });

    // Kosongkan input dan nonaktifkan sementara
    userInput.value = "";
    userInput.disabled = true;

    const button = chatform.querySelector("button");
    button.disabled = true;
    button.textContent = "Menunggu...";

    // ========================
    // Buat bubble AI kosong
    // ========================
    const botContent = addMessage("", "bot");
    let botResponse = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages
            })
        });

        if (!response.ok) {
            let errorMessage = "Terjadi kesalahan";
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // respons bukan JSON, pakai pesan default
            }
            throw new Error(errorMessage);
        }

        // ========================
        // Baca streaming response
        // ========================
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Pisahkan berdasarkan newline
            const lines = buffer.split("\n");

            // Simpan bagian yang belum lengkap
            buffer = lines.pop();

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    continue;
                }
                if (!trimmedLine.startsWith("data: ")) {
                    continue;
                }

                const data = trimmedLine.slice(6).trim();

                if (data === "[DONE]") {
                    continue;
                }

                try {
                    const token = JSON.parse(data);

                    // Tambahkan token ke jawaban
                    botResponse += token;

                    // Update tampilan
                    botContent.textContent = botResponse;

                    // Auto scroll
                    chatBox.scrollTop = chatBox.scrollHeight;
                } catch (error) {
                    console.error("Gagal membaca token:", error);
                }
            }
        }

        // ========================
        // Simpan response AI
        // ========================
        if (botResponse) {
            messages.push({
                role: "assistant",
                content: botResponse
            });
        }
    } catch (error) {
        console.error(error);

        // Buang pesan user yang gagal agar riwayat tetap bergantian
        messages.pop();

        botContent.textContent =
            "Maaf, terjadi kesalahan: " +
            error.message;
    } finally {
        // Aktifkan kembali input
        userInput.disabled = false;
        button.disabled = false;
        button.textContent = "Kirim";
        userInput.focus();
    }
});