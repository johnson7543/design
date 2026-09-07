import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignQR } from 'designqr';
import './style.css';

function App() {
  const [state, setState] = useState({ design: 'tree',
    value: 'https://example.com/shibuya', logo: false, secondLogo: false, second: false, show: true,
    transparentBackground: false, details: {}, zoom: false, readyZoom: null });
  const first = useRef(), second = useRef();
  useEffect(() => { window.fixture = { update: patch => setState(s => ({ ...s, ...patch })), first, second }; }, []);
  const common = { interaction: { motionBlur: false }, onError: error => { window.fixtureError = error; } };
  return React.createElement('main', null,
    state.show && React.createElement(DesignQR, { ...common, key: 'first', ref: first, value: state.value,
      design: state.design, logo: state.logo, className: 'first', details: state.details,
      zoom: state.zoom, onZoomChange: scale => { window.fixtureZoom = scale; },
      onReady: () => { if (state.readyZoom !== null) first.current?.setZoom(state.readyZoom); },
      transparentBackground: state.transparentBackground }),
    state.second && React.createElement(DesignQR, { ...common, key: 'second', ref: second,
      value: 'https://example.com/second', design: 'city',
      logo: state.secondLogo, className: 'second' }));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
