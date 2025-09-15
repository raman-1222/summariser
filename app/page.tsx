'use client';

import React, { useState, useRef, useCallback } from 'react';

export default function AudioRecorderPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [hasAudio, setHasAudio] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^"]+\.[^\s@]+$/.test(email);
  };

  const startRecording = useCallback(async () => {
    try {
      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Get tab audio stream
      const tabStream = await navigator.mediaDevices.getDisplayMedia({ 
        audio: true,
        video: false 
      });

      // Create audio context to mix streams
      const audioContext = new AudioContext();
      const micSource = audioContext.createMediaStreamSource(micStream);
      const tabSource = audioContext.createMediaStreamSource(tabStream);
      const destination = audioContext.createMediaStreamDestination();

      // Connect both sources to destination
      micSource.connect(destination);
      tabSource.connect(destination);

      // Start recording the mixed stream
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setHasAudio(true);
        
        // Clean up streams
        micStream.getTracks().forEach(track => track.stop());
        tabStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setMessage('Recording started... Click DONE when finished.');

    } catch (error) {
      console.error('Error starting recording:', error);
      setMessage('Error: Could not start recording. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setMessage('Recording stopped. Click "Process Audio" to transcribe.');
    }
  }, [isRecording]);

  const processAudio = async () => {
    if (!audioBlob || !apiKey || !validateEmail(email)) {
      setMessage('Please ensure you have recorded audio, entered a valid API key, and email.');
      return;
    }

    setIsProcessing(true);
    setMessage('Transcribing audio...');

    try {
      // Convert blob to File for FormData
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      
      // Create FormData for Whisper API
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');

      // Call OpenAI Whisper API
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        throw new Error('Transcription failed');
      }

      const transcriptionResult = await whisperResponse.json();
      const transcribedText = transcriptionResult.text;
      setTranscription(transcribedText);
      setMessage('Transcription complete. Sending to Lamatic AI...');

      // Send to Lamatic AI workflow
      const lamaticResponse = await fetch('https://api.lamatic.ai/v1/workflows/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: 'your-workflow-id', // Replace with actual workflow ID
          inputs: {
            transcribed_text: transcribedText,
            user_email: email
          }
        }),
      });

      if (!lamaticResponse.ok) {
        throw new Error('Failed to send to Lamatic AI');
      }

      setMessage('Success! Audio processed and sent to Lamatic AI. Check your email for results.');
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a1a', 
      color: 'white', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        textAlign: 'center' 
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '2rem',
          background: 'linear-gradient(45deg, #00ff88, #00ccff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Audio Summariser
        </h1>

        <div style={{ marginBottom: '2rem' }}>
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '15px',
              border: '2px solid #333',
              borderRadius: '8px',
              backgroundColor: '#2a2a2a',
              color: 'white',
              fontSize: '16px'
            }}
          />
          
          <input
            type="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: \\`2px solid \\${validateEmail(email) || email === '' ? '#333' : '#ff4444'}\
              borderRadius: '8px',
              backgroundColor: '#2a2a2a',
              color: 'white',
              fontSize: '16px'
            }}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          {!isRecording && !hasAudio && (
            <button
              onClick={startRecording}
              disabled={!apiKey || !validateEmail(email)}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#00ff88',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '50px',
                cursor: apiKey && validateEmail(email) ? 'pointer' : 'not-allowed',
                opacity: apiKey && validateEmail(email) ? 1 : 0.5,
                margin: '10px'
              }}
            >
              🎤 Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                margin: '10px',
                animation: 'pulse 1.5s infinite'
              }}
            >
              ⏹️ DONE
            </button>
          )}

          {hasAudio && !isRecording && (
            <button
              onClick={processAudio}
              disabled={isProcessing}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#00ccff',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '50px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1,
                margin: '10px'
              }}
            >
              {isProcessing ? '⏳ Processing...' : '🚀 Process Audio'}
            </button>
          )}
        </div>

        {message && (
          <div style={{
            padding: '15px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '1px solid #333'
          }}>
            {message}
          </div>
        )}

        {transcription && (
          <div style={{
            padding: '20px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'left',
            border: '1px solid #00ff88'
          }}>
            <h3 style={{ color: '#00ff88', marginBottom: '10px' }}>Transcription:</h3>
            <p>{transcription}</p>
          </div>
        )}

        <style jsx>{`@keyframes pulse {0% { transform: scale(1); }50% { transform: scale(1.05); }100% { transform: scale(1); }}`}</style>
      </div>
    </div>
  );
}