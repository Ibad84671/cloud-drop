// CloudDrop - Main Application
const API_BASE = window.location.origin + '/api';

window.copyLink = function() {
  const input = document.getElementById('share-link');
  input.select();
  document.execCommand('copy');
  alert('Link copied!');
};

document.addEventListener('DOMContentLoaded', () => {
  // Check auth status (will implement with Cognito later)
  console.log('CloudDrop ready.');
});
