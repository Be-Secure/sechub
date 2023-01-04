package com.mercedesbenz.sechub.commons.core.security.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.security.InvalidKeyException;

import org.junit.jupiter.api.Test;

public class PersistenceCipherFactoryTest {
    @Test
    void create_none_cipher() throws InvalidKeyException {
        PersistenceCipherType cipherType = PersistenceCipherType.NONE;
        String secret = "topSecret";
        
        PersistenceCipher cipher = PersistenceCipherFactory.create(cipherType, secret);
        assertEquals(cipher.getCipher(), cipherType);
    }
    
    @Test
    void create_aes_256_gcm_siv() throws InvalidKeyException {
        PersistenceCipherType cipherType = PersistenceCipherType.AES_256_GCM_SIV;
        String secret = "a".repeat(32);
        
        PersistenceCipher cipher = PersistenceCipherFactory.create(cipherType, secret);
        assertEquals(cipher.getCipher(), cipherType);
    }
}
