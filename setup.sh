#!/bin/bash

echo "🚀 Meeting Note Taker Setup"
echo "============================"
echo ""

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js $NODE_VERSION found"
else
    echo "❌ Node.js not found. Please install Node.js 18 or higher"
    exit 1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm $NPM_VERSION found"
else
    echo "❌ npm not found"
    exit 1
fi

# Check SoX
echo "Checking SoX..."
if command -v sox &> /dev/null; then
    SOX_VERSION=$(sox --version | head -n 1)
    echo "✅ $SOX_VERSION found"
else
    echo "⚠️  SoX not found. Please install it:"
    echo "   macOS: brew install sox"
    echo "   Linux: sudo apt-get install sox libsox-fmt-all"
fi

# Check ffmpeg
echo "Checking ffmpeg..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo "✅ $FFMPEG_VERSION found"
else
    echo "⚠️  ffmpeg not found. Please install it:"
    echo "   macOS: brew install ffmpeg"
    echo "   Linux: sudo apt-get install ffmpeg"
fi

# Check Whisper
echo "Checking Whisper..."
if command -v whisper &> /dev/null; then
    echo "✅ Whisper found"
else
    echo "⚠️  Whisper not found. Please install it:"
    echo "   pipx install --python /opt/homebrew/bin/python3.13 openai-whisper"
    echo "   or: pip3 install openai-whisper"
fi

# Check Ollama
echo "Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama found"
    echo "   Make sure to run 'ollama serve' before using the app"
else
    echo "⚠️  Ollama not found. Please install it:"
    echo "   curl -fsSL https://ollama.com/install.sh | sh"
fi

echo ""
echo "Installing Node.js dependencies..."
npm install

echo ""
echo "============================"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Make sure Ollama is running: ollama serve"
echo "2. Pull a Llama model if not already installed: ollama pull llama3"
echo "3. Run the app: npm start"
echo "4. Complete the setup wizard on first launch"
echo ""

