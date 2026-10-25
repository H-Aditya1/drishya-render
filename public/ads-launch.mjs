// Checkout code and wallet discovery only run after opening this independent popup.
document.getElementById("advertiseOption")?.addEventListener("click", () => {
  let dialog = document.getElementById("advertiseDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "advertiseDialog";
    dialog.setAttribute("aria-label", "Picture advertising demo");
    Object.assign(dialog.style, {
      width: "min(650px,94vw)",
      maxWidth: "94vw",
      padding: "12px",
      background: "#101319",
      color: "#e3d5b6",
    });
    const close = document.createElement("button");
    close.textContent = "CLOSE ×";
    close.className = "ghost";
    close.addEventListener("click", () => dialog.close());
    const frame = document.createElement("iframe");
    frame.src = "/advertise.html";
    frame.title = "Pay with MetaMask and upload two pictures";
    Object.assign(frame.style, {
      width: "100%",
      height: "min(700px,75vh)",
      border: "0",
      display: "block",
    });
    dialog.append(close, frame);
    document.body.append(dialog);
  }
  dialog.showModal();
});
