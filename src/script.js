(function () {
  // Create the chatbot button
  const chatbotButton = document.createElement('div');
  chatbotButton.id = 'chatbot-button';
  chatbotButton.style.position = 'fixed';
  chatbotButton.style.bottom = '20px';
  chatbotButton.style.right = '20px';
  chatbotButton.style.width = '50px';
  chatbotButton.style.height = '50px';
  chatbotButton.style.borderRadius = '50%';
  chatbotButton.style.backgroundColor = '#0078FF';
  chatbotButton.style.color = 'white';
  chatbotButton.style.display = 'flex';
  chatbotButton.style.alignItems = 'center';
  chatbotButton.style.justifyContent = 'center';
  chatbotButton.style.cursor = 'pointer';
  chatbotButton.innerText = '💬';
  document.body.appendChild(chatbotButton);

  // Create the chatbot container
  const chatbotContainer = document.createElement('div');
  chatbotContainer.id = 'chatbot-container';
  chatbotContainer.style.position = 'fixed';
  chatbotContainer.style.bottom = '80px';
  chatbotContainer.style.right = '20px';
  chatbotContainer.style.width = '300px';
  chatbotContainer.style.height = '400px';
  chatbotContainer.style.border = '1px solid #ccc';
  chatbotContainer.style.borderRadius = '8px';
  chatbotContainer.style.backgroundColor = 'white';
  chatbotContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  chatbotContainer.style.display = 'none';
  chatbotContainer.style.flexDirection = 'column';
  chatbotContainer.style.overflow = 'hidden';

  const header = document.createElement('div');
  header.style.padding = '10px';
  header.style.backgroundColor = '#0078FF';
  header.style.color = 'white';
  header.style.fontWeight = 'bold';
  header.innerText = 'Chatbot';
  chatbotContainer.appendChild(header);

  const messages = document.createElement('div');
  messages.id = 'chatbot-messages';
  messages.style.flex = '1';
  messages.style.padding = '10px';
  messages.style.overflowY = 'auto';
  chatbotContainer.appendChild(messages);

  const inputContainer = document.createElement('div');
  inputContainer.style.display = 'flex';

  const input = document.createElement('input');
  input.id = 'chatbot-input';
  input.type = 'text';
  input.style.flex = '1';
  input.style.padding = '10px';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.placeholder = 'Type a message...';
  inputContainer.appendChild(input);

  const sendButton = document.createElement('button');
  sendButton.innerText = 'Send';
  sendButton.style.backgroundColor = '#0078FF';
  sendButton.style.color = 'white';
  sendButton.style.border = 'none';
  sendButton.style.padding = '10px 20px';
  sendButton.style.cursor = 'pointer';
  inputContainer.appendChild(sendButton);

  chatbotContainer.appendChild(inputContainer);
  document.body.appendChild(chatbotContainer);

  // Toggle chatbot visibility
  chatbotButton.onclick = () => {
    chatbotContainer.style.display =
      chatbotContainer.style.display === 'none' ? 'flex' : 'none';
  };

  // Handle sending messages
  sendButton.onclick = async () => {
    const userMessage = input.value.trim();
    if (!userMessage) return;

    // Add user message to the UI
    const userBubble = document.createElement('div');
    userBubble.innerText = userMessage;
    userBubble.style.margin = '10px';
    userBubble.style.padding = '10px';
    userBubble.style.borderRadius = '8px';
    userBubble.style.backgroundColor = '#0078FF';
    userBubble.style.color = 'white';
    userBubble.style.alignSelf = 'flex-end';
    messages.appendChild(userBubble);

    // Call your Next.js API
    const response = await fetch('https://your-nextjs-domain/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });
    const { reply } = await response.json();

    // Add bot response to the UI
    const botBubble = document.createElement('div');
    botBubble.innerText = reply;
    botBubble.style.margin = '10px';
    botBubble.style.padding = '10px';
    botBubble.style.borderRadius = '8px';
    botBubble.style.backgroundColor = '#F1F1F1';
    botBubble.style.alignSelf = 'flex-start';
    messages.appendChild(botBubble);

    // Clear input
    input.value = '';
  };
})();