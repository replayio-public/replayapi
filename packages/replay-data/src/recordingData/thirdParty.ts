const paths: string[] = ["node_modules", "bower_components", "jspm_packages", "vendor"];
const cdns: string[] = ["cdnjs\\.cloudflare\\.com", "unpkg\\.com", "cdn\\.jsdelivr\\.net"];

const thirdPartyUrlPattern = new RegExp(
  "(?:" +
    "(?:^|/)(?:" + // Start of string or slash
    paths.join("|") +
    ")(?:/|$)|" + // End of string or slash
    "^https?://(?:" +
    cdns.join("|") +
    ")/|" + // CDN URLs must end with slash
    "\\.(?:min\\.js$|[a-f0-9]{6,}\\.js$)" +
    ")"
);

export function isThirdPartyUrl(resourceUrl: string): boolean {
  const normalizedUrl = resourceUrl.replace(/\\/g, "/");
  return thirdPartyUrlPattern.test(normalizedUrl);
}

if (require.main === module) {
  console.log("Should not be third party:");
  console.log(isThirdPartyUrl("src/components/App.js"));
  console.log(isThirdPartyUrl("@mycompany/utils/index.js"));
  console.log(isThirdPartyUrl("lib/helpers.js"));

  console.log("\nShould be third party:");
  console.log(isThirdPartyUrl("node_modules/lodash/index.js"));
  console.log(isThirdPartyUrl("vendor/jquery.js"));
  console.log(isThirdPartyUrl("https://cdnjs.cloudflare.com/jquery.js"));
  console.log(isThirdPartyUrl("dist/main.8f9e2a.js"));
  console.log(isThirdPartyUrl("lib/jquery.min.js"));
}
