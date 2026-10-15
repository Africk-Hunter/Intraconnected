// Increment the ID when rotating the recovery key. Keep old server-side key
// version mappings configured while any recovery wraps still use them.
export const RECOVERY_KEY_ID = "k1";

// Base64 SPKI public key for RECOVERY_KEY_ID (the public half of the Cloud KMS
// key; safe to ship in the client).
export const RECOVERY_PUBLIC_KEY_SPKI_BASE64 =
    "MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAoKd76FyZLQ50TusRUfc/1K4oGBc9d0Zz+asm7wTK0ZvNhI7lWmr9hdOb9aS6i8r80aPH+4bCTrnJ089Y0Oy7PRQFle25Y66MtP+72IcyuayY44i7VWl2cMl/zhPRdzkJGC0jcQavzpyTrzpOP+tjueK68ga86SZOpzpxOsP5FcRo55kx/vtCqZETaM3hq2pCfUkpH0fgm5MY2JX6xVa4SzaROos3n0BLtDnhmte2wv6thECuyqrB6Q6Ah/ARFVdyGTaBmID0dhe2vffGAf3ykeORMPUewD293y0U95MqB2o2SZk64HlRApolq4dAfRK/FuweSA0XglLavuc5DYhp9Pa2QMCSM/Ae+HWHH+IquFFPiZiLYftCwCU4Ez9XdgFlVdXvTmvNZoGiR4xAjkxbLr3QnRq0LoC/PTdQGDKVS957k2F3EBHmta24GRm3eu1et9aokXX94GKfjgBxrnYqtkUZG54G7JjGamtpJpNeyTCwA14HFretvnqcXtNjBNalAgMBAAE=";
