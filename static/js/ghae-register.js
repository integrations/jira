$('.ghae-register-link').click(function (event) {
    event.preventDefault()
    let ghaeInstanceHost = new URL(document.getElementById("ghae_url_id").value).hostname
    $.ajax({
      type: 'POST',
      url: `/register?ghaeHost=${encodeURIComponent(ghaeInstanceHost)}`,
      success: function (data) {
        let ghaeInstance = `https://${ghaeInstanceHost}/settings/apps/new?state=${data.state}`
        document.getElementById("ghae_form_id").action = ghaeInstance;
        document.getElementById("manifest").value = data.manifest
        document.getElementById("ghae_form_id").submit()
      }
    })
})