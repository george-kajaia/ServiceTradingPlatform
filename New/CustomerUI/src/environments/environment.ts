export const environment = {
  // Local development
  //apiBaseUrl: 'https://localhost:7044/api',
  //signalRHubUrl: 'https://localhost:7044/hubs/redemption',

  // Production — API and SignalR hub on same domain
  apiBaseUrl: 'https://service-tokens.com/api',
  signalRHubUrl: 'https://service-tokens.com/hubs/redemption',

  // Number of featured tokens shown on the home page (between hero and "How It Works")
  homeFeaturedLimit: 20,

  // Flitt embedded checkout SDK assets (loaded on demand on the checkout page).
  flitt: {
    checkoutJs:  'https://pay.flitt.com/latest/checkout-vue/checkout.js',
    checkoutCss: 'https://pay.flitt.com/latest/checkout-vue/checkout.css'
  }
};
