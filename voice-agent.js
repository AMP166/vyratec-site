// This widget version accepts banner settings through override-config only.
// Preserve dashboard settings while disabling the provider attribution banner.
(async () => {
  const agentId = 'agent_4301m7ry2t8yfzgrm1ysx7tgm9qj';
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/widget`);
    if (!response.ok) throw new Error('Voice assistant configuration unavailable');
    const {widget_config: config} = await response.json();
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Invalid voice assistant configuration');
    }
    const widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', agentId);
    widget.setAttribute('override-config', JSON.stringify({...config, disable_banner: true}));
    document.body.append(widget);
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    document.body.append(script);
  } catch {
    // The enquiry form and direct contact remain available if the provider fails.
    console.warn('Voice assistant unavailable. Please use the contact form.');
  }
})();
