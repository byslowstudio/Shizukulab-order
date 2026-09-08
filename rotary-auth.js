/* =========================================
   ELEMENTS
========================================= */

const knob =
  document.getElementById(
    "rotaryKnob"
  );

const ticks =
  document.getElementById(
    "rotaryTicks"
  );

const createOption =
  document.getElementById(
    "createOption"
  );

const loginOption =
  document.getElementById(
    "loginOption"
  );

const helper =
  document.getElementById(
    "rotaryHelper"
  );

const continueButton =
  document.getElementById(
    "continueButton"
  );

const authSelector =
  document.getElementById(
    "authSelector"
  );

const createPanel =
  document.getElementById(
    "createPanel"
  );

const loginPanel =
  document.getElementById(
    "loginPanel"
  );

const createForm =
  document.getElementById(
    "createAccountForm"
  );

const loginForm =
  document.getElementById(
    "loginForm"
  );

const createStatus =
  document.getElementById(
    "createStatus"
  );

const loginStatus =
  document.getElementById(
    "loginStatus"
  );



/* =========================================
   ROTARY SETTINGS
========================================= */

const CREATE_ANGLE = -40;

const NEUTRAL_ANGLE = 0;

const LOGIN_ANGLE = 40;

const CREATE_THRESHOLD = -18;

const LOGIN_THRESHOLD = 18;



let knobAngle = 0;

let dragging = false;

let lastPointerAngle = null;

let selectedMode = null;



/* =========================================
   TICKS
========================================= */

for (
  let index = 0;
  index < 17;
  index++
) {

  const tick =
    document.createElement(
      "span"
    );

  tick.className =
    "slow-auth__tick";


  const tickAngle =
    -48 +
    index * 6;


  if (
    index === 1 ||
    index === 8 ||
    index === 15
  ) {

    tick.classList.add(
      "slow-auth__tick--major"
    );

  }


  tick.style.transform =
    `rotate(${tickAngle}deg)
     translateY(-108px)`;


  ticks.appendChild(
    tick
  );

}



/* =========================================
   HELPERS
========================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

}



function getPointerAngle(
  event
) {

  const rect =
    knob.getBoundingClientRect();


  const centerX =
    rect.left +
    rect.width / 2;


  const centerY =
    rect.top +
    rect.height / 2;


  return (
    Math.atan2(
      event.clientY -
      centerY,

      event.clientX -
      centerX
    )

    *

    180 /
    Math.PI
  );

}



/* =========================================
   UPDATE UI
========================================= */

function updateRotaryUI() {

  knob.style.transform =
    `rotate(${knobAngle}deg)`;


  createOption
    .classList
    .remove(
      "is-active"
    );


  loginOption
    .classList
    .remove(
      "is-active"
    );


  continueButton.hidden =
    false;



  if (
    knobAngle <=
    CREATE_THRESHOLD
  ) {

    selectedMode =
      "create";


    createOption
      .classList
      .add(
        "is-active"
      );


    helper.textContent =
      "JOIN YOUR TEAM";


    continueButton.textContent =
      "CREATE ACCOUNT";

  }


  else if (
    knobAngle >=
    LOGIN_THRESHOLD
  ) {

    selectedMode =
      "login";


    loginOption
      .classList
      .add(
        "is-active"
      );


    helper.textContent =
      "WELCOME BACK";


    continueButton.textContent =
      "LOG IN";

  }


  else {

    selectedMode = null;

    helper.textContent =
      "TURN TO BEGIN";

    continueButton.hidden =
      true;

  }

}



/* =========================================
   POINTER DRAG
========================================= */

knob.addEventListener(
  "pointerdown",

  event => {

    dragging = true;

    knob.classList.add(
      "is-dragging"
    );


    knob.setPointerCapture(
      event.pointerId
    );


    lastPointerAngle =
      getPointerAngle(
        event
      );

  }
);



knob.addEventListener(
  "pointermove",

  event => {

    if (!dragging) {
      return;
    }


    const currentPointerAngle =
      getPointerAngle(
        event
      );


    let delta =
      currentPointerAngle -
      lastPointerAngle;



    /*
      Handle crossing
      +180 / -180
    */

    if (
      delta > 180
    ) {

      delta -= 360;

    }


    if (
      delta < -180
    ) {

      delta += 360;

    }



    knobAngle =
      clamp(

        knobAngle +
        delta,

        CREATE_ANGLE,

        LOGIN_ANGLE
      );



    lastPointerAngle =
      currentPointerAngle;


    updateRotaryUI();

  }
);



/* =========================================
   SNAP
========================================= */

function finishDrag() {

  dragging = false;

  lastPointerAngle = null;


  knob.classList.remove(
    "is-dragging"
  );



  if (
    knobAngle <=
    CREATE_THRESHOLD
  ) {

    knobAngle =
      CREATE_ANGLE;

  }


  else if (
    knobAngle >=
    LOGIN_THRESHOLD
  ) {

    knobAngle =
      LOGIN_ANGLE;

  }


  else {

    knobAngle =
      NEUTRAL_ANGLE;

  }


  updateRotaryUI();

}



knob.addEventListener(
  "pointerup",
  finishDrag
);


knob.addEventListener(
  "pointercancel",
  finishDrag
);



/* =========================================
   SIDE LABEL CLICK
========================================= */

createOption.addEventListener(
  "click",

  () => {

    knobAngle =
      CREATE_ANGLE;

    updateRotaryUI();

  }
);



loginOption.addEventListener(
  "click",

  () => {

    knobAngle =
      LOGIN_ANGLE;

    updateRotaryUI();

  }
);



/* =========================================
   KEYBOARD
========================================= */

knob.addEventListener(
  "keydown",

  event => {


    if (
      event.key ===
      "ArrowLeft"
    ) {

      event.preventDefault();

      knobAngle =
        CREATE_ANGLE;

      updateRotaryUI();

    }


    if (
      event.key ===
      "ArrowRight"
    ) {

      event.preventDefault();

      knobAngle =
        LOGIN_ANGLE;

      updateRotaryUI();

    }


    if (
      event.key ===
      "Home"
    ) {

      event.preventDefault();

      knobAngle =
        NEUTRAL_ANGLE;

      updateRotaryUI();

    }


    if (
      event.key ===
      "Enter"

      ||

      event.key ===
      " "
    ) {

      event.preventDefault();

      openSelectedPanel();

    }

  }
);



/* =========================================
   OPEN FORM
========================================= */

function openSelectedPanel() {

  if (!selectedMode) {
    return;
  }


  authSelector.hidden =
    true;


  if (
    selectedMode ===
    "create"
  ) {

    createPanel.hidden =
      false;

  }


  if (
    selectedMode ===
    "login"
  ) {

    loginPanel.hidden =
      false;

  }

}



continueButton.addEventListener(
  "click",
  openSelectedPanel
);



/* =========================================
   BACK
========================================= */

document
  .querySelectorAll(
    "[data-auth-back]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",

        () => {

          createPanel.hidden =
            true;

          loginPanel.hidden =
            true;

          authSelector.hidden =
            false;


          knobAngle =
            NEUTRAL_ANGLE;


          updateRotaryUI();

        }
      );

    }
  );



/* =========================================
   CREATE ACCOUNT
========================================= */

createForm.addEventListener(
  "submit",

  async event => {

    event.preventDefault();


    clearStatus(
      createStatus
    );


    const email =
      document
        .getElementById(
          "createEmail"
        )
        .value
        .trim()
        .toLowerCase();


    const password =
      document
        .getElementById(
          "createPassword"
        )
        .value;


    const confirmPassword =
      document
        .getElementById(
          "createPasswordConfirm"
        )
        .value;



    if (
      !email ||
      !password
    ) {

      showError(
        createStatus,
        "Please complete all fields."
      );

      return;

    }



    if (
      password !==
      confirmPassword
    ) {

      showError(
        createStatus,
        "Passwords do not match."
      );

      return;

    }



    if (
      password.length < 8
    ) {

      showError(
        createStatus,
        "Use at least 8 characters."
      );

      return;

    }



    try {

      setFormBusy(
        createForm,
        true
      );



      /*
        IMPORTANT

        `supabase` below should be
        your EXISTING Supabase client.

        Do NOT create a service-role
        client in browser code.
      */


      const {
        data,
        error
      } =
        await supabase.auth.signUp({

          email,

          password

        });



      if (error) {
        throw error;
      }



      /*
        If email confirmation is enabled,
        there may not be a session yet.
      */

      if (
        !data.session
      ) {

        showSuccess(
          createStatus,

          "Account created. Check your email to confirm your account."
        );

        return;

      }



      await claimStaffInvitation();



    }

    catch (error) {

      console.error(
        "Create account failed:",
        error
      );


      showError(
        createStatus,
        error.message ||
        "Unable to create account."
      );

    }

    finally {

      setFormBusy(
        createForm,
        false
      );

    }

  }
);



/* =========================================
   CLAIM INVITATION
========================================= */

async function claimStaffInvitation() {

  /*
    IMPORTANT SECURITY RULE:

    Do NOT send role:
      admin
      operations
      finance

    from browser.

    Database/backend decides
    the role from the invitation.
  */


  const {
    data,
    error
  } =
    await supabase.rpc(
      "claim_business_invitation"
    );



  if (error) {

    /*
      If no invitation exists,
      do NOT create a business.
    */

    throw new Error(
      error.message ||
      "No valid invitation found."
    );

  }



  if (!data) {

    throw new Error(
      "No invitation found for this email."
    );

  }



  window.location.href =
    "/";

}



/* =========================================
   LOG IN
========================================= */

loginForm.addEventListener(
  "submit",

  async event => {

    event.preventDefault();


    clearStatus(
      loginStatus
    );


    const email =
      document
        .getElementById(
          "loginEmail"
        )
        .value
        .trim()
        .toLowerCase();


    const password =
      document
        .getElementById(
          "loginPassword"
        )
        .value;



    if (
      !email ||
      !password
    ) {

      showError(
        loginStatus,
        "Enter your email and password."
      );

      return;

    }



    try {

      setFormBusy(
        loginForm,
        true
      );


      const {
        data,
        error
      } =
        await supabase
          .auth
          .signInWithPassword({

            email,

            password

          });



      if (error) {
        throw error;
      }



      /*
        Optional:
        resolve memberships here
        before redirecting.
      */


      window.location.href =
        "/";

    }

    catch (error) {

      console.error(
        "Login failed:",
        error
      );


      showError(
        loginStatus,
        "Email or password is incorrect."
      );

    }

    finally {

      setFormBusy(
        loginForm,
        false
      );

    }

  }
);



/* =========================================
   STATUS HELPERS
========================================= */

function clearStatus(
  element
) {

  element.textContent =
    "";

  element.classList.remove(
    "is-error",
    "is-success"
  );

}



function showError(
  element,
  message
) {

  element.textContent =
    message;

  element.classList.remove(
    "is-success"
  );

  element.classList.add(
    "is-error"
  );

}



function showSuccess(
  element,
  message
) {

  element.textContent =
    message;

  element.classList.remove(
    "is-error"
  );

  element.classList.add(
    "is-success"
  );

}



function setFormBusy(
  form,
  busy
) {

  form
    .querySelectorAll(
      "input, button"
    )
    .forEach(

      element => {

        element.disabled =
          busy;

      }

    );

}



/* =========================================
   INITIAL STATE
========================================= */

updateRotaryUI();
