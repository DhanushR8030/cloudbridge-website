// Central place for business details used across the site. Edit here.
export const SITE = {
  name: 'CloudBridge Technologies',
  url: 'https://cloudbridge-technologies.com',
  tagline: 'Building Digital Foundations',
  email: 'technologiescloudbridge@gmail.com',
  phone: '',
  // WhatsApp number in international format, digits only, no + or spaces
  // (e.g. '919876543210' for +91 98765 43210). Leave empty to hide the
  // floating WhatsApp button.
  whatsapp: '919790686377',
  // Where form submissions are delivered, via FormSubmit.co. This uses the hashed ID
  // FormSubmit issued for technologiescloudbridge@gmail.com (from their activation email)
  // instead of the raw address, so the real email isn't exposed in the page source. Submissions
  // still land in technologiescloudbridge@gmail.com either way.
  //
  // IMPORTANT: FormSubmit ties activation to the exact origin (domain) a submission comes
  // from. This was activated from http://localhost:5173/ during testing. The FIRST submission
  // after the real site goes live on cloudbridge-technologies.com will trigger one more
  // one-time "confirm activation" email for that domain - that's expected, just click it once.
  formEndpoint: 'https://formsubmit.co/ajax/51309b29d18bcb53e3de407e361d3a97',
  // Google tag / Google Ads ID, e.g. 'G-XXXXXXXXXX' or 'AW-XXXXXXXXX'. Leave empty to disable tracking.
  gtagId: '',
  // While true, sections filled with sample content show a "Sample content" tag.
  // Nothing on the site is flagged as sample content right now.
  showSampleNotice: false,
};
