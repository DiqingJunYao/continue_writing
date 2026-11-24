const localHostname = globalThis.location?.hostname || "";
const localSearch = globalThis.location?.search || "";
const useLocalEmulators =
  ["localhost", "127.0.0.1", "::1"].includes(localHostname) &&
  new URLSearchParams(localSearch).get("emulators") === "1";

// Firebase web configuration is a public project identifier, not a credential.
// Never add service-account JSON, private keys, or the Facebook app secret here.
const productionFirebaseConfig = {
  apiKey: "AIzaSyDgAtWPSIgHl1SfdLU10U_myKoW-dDGwjE",
  authDomain: "continuewriting-9e48b.firebaseapp.com",
  projectId: "continuewriting-9e48b",
  storageBucket: "continuewriting-9e48b.firebasestorage.app",
  messagingSenderId: "642967054612",
  appId: "1:642967054612:web:7cb466b69d315136d73a01",
  measurementId: "G-C9QC3PX3GX",
};

export const firebaseConfig = Object.freeze(
  useLocalEmulators
    ? { ...productionFirebaseConfig, projectId: "demo-branchline" }
    : productionFirebaseConfig,
);

export const firebaseFunctionsRegion = "europe-west1";

// Public reCAPTCHA Enterprise site key registered for this web app. Leave
// empty until App Check is configured in the Firebase and Google Cloud consoles.
export const firebaseAppCheckSiteKey = "";

// Local emulators are opt-in at http://localhost:4173/?emulators=1 and can
// never be enabled from a production hostname.
export const firebaseEmulators = Object.freeze({
  enabled: useLocalEmulators,
  host: "127.0.0.1",
  authPort: 9099,
  functionsPort: 5001,
});
