# Käyttökokemuksia CSC Aitan rajapinnasta

GAIK-hankkeen käyttäjäpalautetta 20.11.2026. Testasin Aitan rajapintaa lyhyillä teksteillä ja synteettisellä englanninkielisellä äänitteellä. Alla ovat pyynnöt ja niistä saadut vastaukset, jotta CSC voi toistaa havainnot.

## Toistettavat havainnot

| Malli tai rajapinta | Mitä pyysin | Mitä sain |
| --- | --- | --- |
| `intfloat/multilingual-e5-large` | Sama teksti, ensin `encoding_format="float"`, sitten `"base64"`. Molemmat arvot ovat OpenAPI-kuvauksessa. | Molemmilla HTTP 200 ja 1 024 luvun JSON-lista. Base64-merkkijonoa odottava asiakas saa listan. |
| `intfloat/multilingual-e5-large` | 510 välilyönnein erotettua `a`-kirjainta, sitten 511. | Ensimmäinen palautti HTTP 200 ja ilmoitti 512 tokenia. Yhden sanan lisäys palautti HTTP 500 ilman mainintaa pituusrajasta. Syötevirhe ja tieto enimmäispituudesta auttaisivat korjaamaan pyynnön. |
| `openai/whisper-large-v3` | Kuuden sekunnin WAV-tiedosto, `response_format=verbose_json` ja `timestamp_granularities[]=word`. | HTTP 200 ja oikea litterointi. Vastauksessa oli yksi aikaleimattu segmentti. Sanakohtaiset aikaleimat puuttuivat sekä ylätasolta että segmentistä. |
| Litteroinnin OpenAPI-kuvaus | Vertailin koneellista määrittelyä toimivaan tiedostolähetykseen ja tekstivastaukseen. | Pyynnön tyypiksi on listattu vain `application/x-www-form-urlencoded`, vaikka reitin ohje ja toimiva WAV-lähetys käyttävät `multipart/form-data`. Onnistuneelle vastaukselle on listattu vain `application/json`, vaikka `response_format=text` palautti `text/plain`. |

**Whisper turbon saatavuus.** Samalla WAV-tiedostolla tavallinen large v3 vastasi noin sekunnissa. Turbolta ei tullut litterointia kahdella 80 sekunnin asiakasaikarajalla tehdyllä yrityksellä. Ensimmäisen jälkeen worker-rajapinnassa näkyivät tilat `failed` ja `requested`. Uusinnassa molemmat tilat näkyivät sekä ennen pyyntöä että sen jälkeen. Viiveen syy jäi avoimeksi.

## Kokeile itse

Aja komennot repon juuressa Bunilla (testattu versiolla 1.4.2). Paketteja ei tarvitse asentaa. `spec` lukee julkista OpenAPI-kuvausta. Muita kokeita varten aseta oma Aitta-avain ympäristömuuttujaan `AITTA_API_TOKEN`.

```sh
bun check.mjs spec
bun check.mjs e5
bun check.mjs whisper
bun check.mjs turbo
```

`e5` lähettää neljä pyyntöä reitille `POST /openai/v1/embeddings`. Puhetestit lähettävät mukana olevan [testiäänitteen](notebooks.wav) reitille `POST /openai/v1/audio/transcriptions`. `turbo` tarkistaa myös workerien tilan ennen litterointiyritystä ja sen jälkeen. Tuloste näyttää kulloisenkin API-vastauksen.

## Muut havainnot 20.11.2026

- **Dokumenttihaku demossa.** Yhden sivun indeksointi kesti ensimmäisessä ajossa noin 76 sekuntia ja uusinnassa sekunnin. Uusinnan alussa e5 näkyi käynnissä. Vastaus lähdeviitteineen tuli 4–5 sekunnissa.
- **gpt-oss 120B ja Gemma 4 31B.** Saman laskun luokittelu demossa kesti gpt-ossilla noin 4 sekuntia ja Gemmalla noin 18 sekuntia. gpt-oss tunnisti summat `EUR 60` ja `60 euros` samoiksi ensin 54 sekunnissa ja viimeisellä ajolla 2,3 sekunnissa. Nämä ovat yksittäisiä mittauksia. Usean käyttäjän kuormaa ei mitattu.
- **Suorat mallipyynnöt.** Gemma luki PNG-kuvasta laskun numeron `4827` oikein noin viidessä sekunnissa. gpt-oss palautti `reasoning_effort=none`-asetuksella HTTP 400:n ja asetuksella `low` HTTP 200:n sekä päättelyä. Nämä kertovat testattujen mallien käyttäytymisestä.

Aitan ylläpitämät kuvaukset löytyvät [OpenAPI-määrittelystä](https://aitta-api.csc.fi/openapi.json) ja [LUMIn käyttöohjeesta](https://docs.lumi-supercomputer.eu/laif/inference/aitta/).
