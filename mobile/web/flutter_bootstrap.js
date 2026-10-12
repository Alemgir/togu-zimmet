{{flutter_js}}
{{flutter_build_config}}

// Uygulama, sayfadaki telefon çerçevesinin (#ekran) içine yerleşir.
_flutter.loader.load({
  onEntrypointLoaded: async (engineInitializer) => {
    const engine = await engineInitializer.initializeEngine({ hostElement: document.querySelector('#ekran') });
    document.body.classList.add('hazir');
    await engine.runApp();
  },
});
