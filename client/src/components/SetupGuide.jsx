import React from 'react';
import { CheckCircle, Circle, Mail, Key, Newspaper } from 'lucide-react';

export default function SetupGuide({ authenticated, onConnect, onDone }) {
  const steps = [
    {
      title: 'Connect Gmail',
      description: 'Link your Gmail account so we can read your newsletters.',
      done: authenticated,
      action: !authenticated ? (
        <button className="btn btn-primary" onClick={onConnect}>
          <Mail size={16} /> Connect Gmail
        </button>
      ) : null,
    },
    {
      title: 'Add API Key',
      description: 'Set your Anthropic API key in the .env file for AI-powered curation.',
      done: false, // Can't check from frontend
      action: (
        <div className="setup-code">
          <code>ANTHROPIC_API_KEY=sk-ant-...</code>
          <p className="hint">Add this to your <strong>.env</strong> file in the project root</p>
        </div>
      ),
    },
    {
      title: 'Add Newsletter Sources',
      description: 'Tell us which email addresses send you newsletters.',
      done: false,
      action: authenticated ? (
        <button className="btn btn-secondary" onClick={onDone}>
          <Newspaper size={16} /> Add Sources
        </button>
      ) : null,
    },
  ];

  return (
    <div className="setup-guide">
      <div className="setup-header">
        <h2>Welcome to The Digestino</h2>
        <p>Let's get you set up in three easy steps.</p>
      </div>

      <div className="setup-steps">
        {steps.map((step, i) => (
          <div key={i} className={`setup-step ${step.done ? 'done' : ''}`}>
            <div className="step-indicator">
              {step.done ? (
                <CheckCircle size={24} className="step-done-icon" />
              ) : (
                <Circle size={24} className="step-pending-icon" />
              )}
              {i < steps.length - 1 && <div className="step-line" />}
            </div>
            <div className="step-content">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {step.action && <div className="step-action">{step.action}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="setup-info">
        <h3>How it works</h3>
        <p>
          The Digestino connects to your Gmail, reads newsletters from the sources you
          specify, and uses AI to curate a single, beautiful daily digest. It picks the most
          relevant stories, avoids duplicates, and presents everything in a clean format —
          so you stay informed without the noise.
        </p>
      </div>
    </div>
  );
}
