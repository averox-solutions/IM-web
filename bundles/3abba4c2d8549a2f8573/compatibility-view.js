"use strict";
(self.webpackChunkelement_web = self.webpackChunkelement_web || []).push([
  [6145],
  {
    "./src/async-components/structures/CompatibilityView.tsx": (e, t, a) => {
      a.r(t), a.d(t, { default: () => m });
      var l = a("./node_modules/react/index.js"),
        r = a("./node_modules/matrix-react-sdk/src/SdkConfig.ts"),
        n = a("./src/languageHandler.tsx");
      const m = ({ onAccept: e }) => {
        const t = r.Ay.get("brand"),
          a = r.Ay.get("mobile_builds");
        let m;
        const o = null == a ? void 0 : a.ios;
        null !== o &&
          (m = l.createElement(
            l.Fragment,
            null,
           
          ));
        let c = [
          l.createElement(
            "p",
            { className: "mx_Spacer", key: "header" },
            l.createElement("strong", null, "Android")
          ),
        ];
        const s = null == a ? void 0 : a.android,
          i = null == a ? void 0 : a.fdroid;
        null !== s &&
          c.push(
          
          ),
          null !== i &&
            c.push(
           
            ),
          1 === c.length && (c = []);
        // let _ = l.createElement(
        //   "h2",
        //   { id: "step2_heading" },
        //   (0, n._t)("use_brand_on_mobile", { brand: t })
        // );
        return (
          c.length || m || (_ = null),
          l.createElement(
            "div",
            { className: "mx_ErrorView" },
            l.createElement(
              "div",
              { className: "mx_ErrorView_container" },
              l.createElement(
                "div",
                { className: "mx_HomePage_header" },
                l.createElement(
                  "span",
                  { className: "mx_HomePage_logo" },
                  l.createElement("img", {
                    height: "500", width: "900",
                    src: "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/beep.png?alt=media&token=c49aa4c8-fe3f-4dc0-af5d-6b2e1c6b3a19",
                    alt: "Element",
                  })
                ),
               
              ),
              l.createElement(
                "div",
                { className: "mx_HomePage_col" },
                l.createElement(
                  "div",
                  { className: "mx_HomePage_row" },
                  l.createElement(
                    "div",
                    null,
                     
                    
                    l.createElement(
                      "button",
                      { 
                        onClick: e, 
                        style: {
                          backgroundColor: "#488D41", // Green background color
                          color: "#fff",              // White text color
                          padding: "10px 20px",       // Padding
                          border: "none",             // No border
                          borderRadius: "5px",        // Rounded corners
                          fontSize: "16px",           // Font size
                          cursor: "pointer",          // Pointer cursor on hover
                          transition: "background-color 0.3s ease" // Smooth background color transition
                        },
                        onMouseOver: () => {
                          const btn = document.querySelector('button');
                          if (btn) btn.style.backgroundColor = '#3A6D34'; // Darker green on hover
                        },
                        onMouseOut: () => {
                          const btn = document.querySelector('button');
                          if (btn) btn.style.backgroundColor = '#488D41'; // Original green color
                        }
                      },
                      (0, n._t)("Click to continue")
                    )
                    
                  )
                )
              ),
              l.createElement(
                "div",
                { className: "mx_HomePage_col" },
                l.createElement(
                  "div",
                  { className: "mx_HomePage_row" },
                  l.createElement("div", null, _, m, c)
                )
              ),
              l.createElement(
                "div",
                { className: "mx_HomePage_row mx_Center mx_Spacer" },
                l.createElement(
                  "p",
                  { className: "mx_Spacer" },
                  l.createElement(
                    "a",
                    {
                      href: "https://averox.pk/",
                      target: "_blank",
                      className: "mx_FooterLink",
                    },
                    (0, n._t)("Developed By Avarox Team")
                  )
                )
              )
            )
          )
        );
      };
    },
  },
]);
//# sourceMappingURL=compatibility-view.js.map
function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  let browserName = "Unknown";
  let fullVersion = "Unknown";

  if (/chrome/i.test(userAgent)) {
    browserName = "Chrome";
    fullVersion = userAgent.match(/chrome\/(\d+\.\d+)/i)[1];
  } else if (/firefox/i.test(userAgent)) {
    browserName = "Firefox";
    fullVersion = userAgent.match(/firefox\/(\d+\.\d+)/i)[1];
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browserName = "Safari";
    fullVersion = userAgent.match(/version\/(\d+\.\d+)/i)[1];
  } else if (/msie|trident/i.test(userAgent)) {
    browserName = "Internet Explorer";
    fullVersion = userAgent.match(/(msie\s|rv:)(\d+\.\d+)/i)[2];
  } else if (/edg/i.test(userAgent)) {
    browserName = "Edge";
    fullVersion = userAgent.match(/edg\/(\d+\.\d+)/i)[1];
  }

  return { browserName, fullVersion };
}
