const chatSkeletonHtml = `
    <div id="chatWidget" class="chat-widget">
        <div class="chat-header">
            <div class="chat-avatar">
                <img src="./cha_logo.jpg" alt="AI Avatar" class="avatar-image">
            </div>
            <div class="chat-title">
                <h3>Mars-AI Chatbot</h3>
            </div>
            <div class="toggle-container">
                <span id="modeLabel">Marlabs</span>
                <label class="switch">
                    <input type="checkbox" id="modeToggle">
                    <span class="slider round"></span>
                </label>
                <button id="resetChat" title="Reset chat" class="reset-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                    </svg>
                </button>
            </div>
        </div>
        <div id="chatMessages" class="chat-messages"></div>
        <form id="chatForm" class="chat-form">
            <input type="text" id="chatInput" placeholder="Type your message..." required>
            <button type="submit" id="sendButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
        </form>
    </div>
`
const chatbot_container = document.getElementById('chatbot-container')
// tempDiv.id = 'chat-container'
chatbot_container.innerHTML = chatSkeletonHtml.trim() // Trim whitespace
document.body.append(chatbot_container)

document.addEventListener('DOMContentLoaded', () => {
  console.log(document.cookie);

  // const chatButton = document.getElementById('chatButton')
  // const chatWidget = document.getElementById('chatWidget')
  // const closeButton = document.getElementById('closeButton')
  const chatForm = document.getElementById('chatForm')
  const chatInput = document.getElementById('chatInput')
  const chatMessages = document.getElementById('chatMessages')
  const sendButton = document.getElementById('sendButton')
  const modeToggle = document.getElementById('modeToggle');
  const modeLabel = document.getElementById('modeLabel');
  const resetButton = document.getElementById('resetChat');

  // let isOpen = false
  // let isTyping = false
  let isMarlabsMode = true; // Default mode
  let isResetChat = 'no';

  // function toggleChat() {
  //   isOpen = !isOpen
  //   chatButton.style.display = isOpen ? 'none' : 'flex'
  //   chatWidget.style.display = isOpen ? 'flex' : 'none'
  //   if (isOpen) {
  //     chatWidget.style.transform = 'scale(1)'
  //     chatWidget.style.opacity = '1'
  //   } else {
  //     chatWidget.style.transform = 'scale(0.95)'
  //     chatWidget.style.opacity = '0'
  //   }
  // }

  // chatButton.addEventListener('click', toggleChat)
  // closeButton.addEventListener('click', toggleChat)

  function addMessage(id, text, sender) {
    const messageElement = document.createElement('div')
    messageElement.classList.add('message', sender)
    messageElement.textContent = text
    messageElement.id = id
    chatMessages.appendChild(messageElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function addTypingIndicator() {
    const indicatorElement = document.createElement('div')
    indicatorElement.classList.add('typing-indicator')
    indicatorElement.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `
    chatMessages.appendChild(indicatorElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function removeTypingIndicator() {
    const indicator = chatMessages.querySelector('.typing-indicator')
    if (indicator) {
      chatMessages.removeChild(indicator)
    }
  }
  
  // ----- Convert Markdown to HTML ------
  function convertMarkdownToHTML(markdown) {
    // Convert headers: lines starting with one to six '#' characters
    markdown = markdown.replace(/^###### (.*$)/gm, "<h6>$1</h6>");
    markdown = markdown.replace(/^##### (.*$)/gm, "<h5>$1</h5>");
    markdown = markdown.replace(/^#### (.*$)/gm, "<h4>$1</h4>");
    markdown = markdown.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    markdown = markdown.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    markdown = markdown.replace(/^# (.*$)/gm, "<h1>$1</h1>");
    
    // Convert bold text: **text**
    markdown = markdown.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    
    // Convert italic text: *text*
    markdown = markdown.replace(/\*(.+?)\*/g, "<em>$1</em>");
    
    // Convert line breaks to <br> tags (optional)
    markdown = markdown.replace(/\n/g, "<br>");

    // Links to a tag
    // const linkRegex = /(https?\:\/\/)?(www\.)?[^\s]+\.[^\s]+/g
    const linkRegex = /https?:\/\/[^\s)]+/g;
    
    markdown = markdown.replace(linkRegex, function(matched) {
      let withProtocol = matched
    
      const newStr = `<a
          class="job-link"
          href="${withProtocol}"
          target="_blank"
        >Link</a>
      `
    
      return newStr
    })
    
    return markdown;
  }

  // API call supporting both streaming and non-streaming responses.
  async function fetchChatResponse(userMessage) {
    const id = Date.now()
    addTypingIndicator()
    const params = `type=${isMarlabsMode ? 'private' : 'llm'}&reset=${isResetChat}`
    isResetChat='no'
    
    const response = await fetch((`./chat?${params}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    removeTypingIndicator()

    while (true) {
      const chunk = await reader.read()
      const { done, value } = chunk
      if (done) break

      // Decode the chunk and append it to your result or update your UI
      let decodedChunk = decoder.decode(value)

      // For example, update the UI with the new text:
      console.log('Received chunk:', decodedChunk)
      addMessage(id, decodedChunk, 'bot', true)
    }
    //convert links to a tag
    let message = document.getElementById(id)
    message.innerHTML = convertMarkdownToHTML(message.innerHTML)
  }

  function resetChat() {
    chatMessages.innerHTML = '';
    isResetChat = 'yes'
  }

  modeToggle.addEventListener('change', () => {
    isMarlabsMode = !isMarlabsMode;
    modeLabel.textContent = isMarlabsMode ? 'Marlabs' : 'LLM';
    // resetChat();
  });

  resetButton.addEventListener('click', resetChat);

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const message = chatInput.value.trim()
    if (message) {
      const id = Date.now()
      addMessage(id, message, 'user')
      chatInput.value = ''
      sendButton.disabled = true

      // Simulate bot response
      isTyping = true
      fetchChatResponse(message)
    }
  })

  chatInput.addEventListener('input', () => {
    sendButton.disabled = chatInput.value.trim() === ''
  })

  // Initial message
  // addMessage('001','Hello! How can I help you today?', 'bot')
})
