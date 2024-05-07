package com.mercedesbenz.sechub.wrapper.prepare.modules;

import static com.mercedesbenz.sechub.wrapper.prepare.cli.PrepareWrapperEnvironmentVariables.PDS_PREPARE_CREDENTIAL_PASSWORD;
import static com.mercedesbenz.sechub.wrapper.prepare.cli.PrepareWrapperEnvironmentVariables.PDS_PREPARE_CREDENTIAL_USERNAME;
import static com.mercedesbenz.sechub.wrapper.prepare.cli.PrepareWrapperKeyConstants.KEY_PDS_PREPARE_MODULE_SKOPEO_ENABLED;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import javax.crypto.SealedObject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.mercedesbenz.sechub.commons.core.security.CryptoAccess;
import com.mercedesbenz.sechub.commons.model.*;
import com.mercedesbenz.sechub.wrapper.prepare.prepare.PrepareWrapperContext;

@Service
public class PrepareWrapperModuleSkopeo implements PrepareWrapperModule {

    Logger LOG = LoggerFactory.getLogger(PrepareWrapperModuleSkopeo.class);

    private static final String TYPE = "docker";

    @Value("${" + KEY_PDS_PREPARE_MODULE_SKOPEO_ENABLED + ":true}")
    private boolean pdsPrepareModuleSkopeoEnabled;

    @Autowired
    SkopeoInputValidator skopeoInputValidator;

    @Autowired
    WrapperSkopeo skopeo;

    @Override
    public boolean isAbleToPrepare(PrepareWrapperContext context) {

        if (!pdsPrepareModuleSkopeoEnabled) {
            LOG.debug("Skopeo module is disabled");
            return false;
        }

        for (SecHubRemoteDataConfiguration secHubRemoteDataConfiguration : context.getRemoteDataConfigurationList()) {
            String location = secHubRemoteDataConfiguration.getLocation();

            skopeoInputValidator.validateLocationCharacters(location, null);

            if (isMatchingSkopeoType(secHubRemoteDataConfiguration.getType())) {
                LOG.debug("Type is: " + TYPE);
                if (!skopeoInputValidator.validateLocation(location)) {
                    context.getUserMessages().add(new SecHubMessage(SecHubMessageType.WARNING, "Type is " + TYPE + " but location does not match URL pattern"));
                    LOG.warn("User defined type as " + TYPE + ", but the defined location was not a valid location: {}", location);
                    return false;
                }
                return true;
            }

            if (skopeoInputValidator.validateLocation(location)) {
                LOG.debug("Location is a " + TYPE + " URL");
                return true;
            }

        }
        return false;
    }

    @Override
    public void prepare(PrepareWrapperContext context) throws IOException {
        LOG.debug("Start remote data preparation for GIT repository");

        List<SecHubRemoteDataConfiguration> remoteDataConfigurationList = context.getRemoteDataConfigurationList();

        for (SecHubRemoteDataConfiguration secHubRemoteDataConfiguration : remoteDataConfigurationList) {
            prepareRemoteConfiguration(context, secHubRemoteDataConfiguration);
        }

        if (!isDownloadSuccessful(context)) {
            throw new IOException("Download of git repository was not successful.");
        }
    }

    boolean isDownloadSuccessful(PrepareWrapperContext context) {
        // check if download folder contains docker archive
        Path path = Paths.get(context.getEnvironment().getPdsPrepareUploadFolderDirectory());
        if (Files.isDirectory(path)) {
            String gitFile = "image.tar";
            Path gitPath = Paths.get(path + "/" + gitFile);
            return Files.exists(gitPath);
        }
        return false;
    }

    private void prepareRemoteConfiguration(PrepareWrapperContext context, SecHubRemoteDataConfiguration secHubRemoteDataConfiguration) throws IOException {
        String location = secHubRemoteDataConfiguration.getLocation();
        Optional<SecHubRemoteCredentialConfiguration> credentials = secHubRemoteDataConfiguration.getCredentials();

        if (!credentials.isPresent()) {
            downloadPublicImage(context, location);
            return;
        }

        Optional<SecHubRemoteCredentialUserData> optUser = credentials.get().getUser();
        if (optUser.isPresent()) {
            SecHubRemoteCredentialUserData user = optUser.get();
            downloadPrivateImage(context, user, location);
            return;
        }

        throw new IllegalStateException("Defined credentials have no credential user data for location: " + location);
    }

    private void downloadPrivateImage(PrepareWrapperContext context, SecHubRemoteCredentialUserData user, String location) throws IOException {
        assertUserCredentials(user);

        HashMap<String, SealedObject> credentialMap = new HashMap<>();
        addSealedUserCredentials(user, credentialMap);

        /* @formatter:off */
        SkopeoContext skopeoContext = (SkopeoContext) new SkopeoContext.SkopeoContextBuilder().
                setLocation(location).
                setCredentialMap(credentialMap).
                setUploadDirectory(context.getEnvironment().getPdsPrepareUploadFolderDirectory()).
                build();
        /* @formatter:on */

        skopeo.download(skopeoContext);

        SecHubMessage message = new SecHubMessage(SecHubMessageType.INFO, "Cloned private repository: " + location);
        context.getUserMessages().add(message);
    }

    private static void addSealedUserCredentials(SecHubRemoteCredentialUserData user, HashMap<String, SealedObject> credentialMap) {
        SealedObject sealedUsername = CryptoAccess.CRYPTO_STRING.seal(user.getName());
        SealedObject sealedPassword = CryptoAccess.CRYPTO_STRING.seal(user.getPassword());
        credentialMap.put(PDS_PREPARE_CREDENTIAL_USERNAME, sealedUsername);
        credentialMap.put(PDS_PREPARE_CREDENTIAL_PASSWORD, sealedPassword);
    }

    private void assertUserCredentials(SecHubRemoteCredentialUserData user) {
        skopeoInputValidator.validateUsername(user.getName());
        skopeoInputValidator.validatePassword(user.getPassword());
    }

    private void downloadPublicImage(PrepareWrapperContext context, String location) throws IOException {
        /* @formatter:off */
        SkopeoContext skopeoContext = (SkopeoContext) new SkopeoContext.SkopeoContextBuilder().
                setLocation(location).
                setUploadDirectory(context.getEnvironment().getPdsPrepareUploadFolderDirectory()).
                build();
        /* @formatter:on */

        skopeo.download(skopeoContext);

        SecHubMessage message = new SecHubMessage(SecHubMessageType.INFO, "Cloned public repository: " + location);
        context.getUserMessages().add(message);
    }

    private boolean isMatchingSkopeoType(String type) {
        if (type == null || type.isBlank()) {
            return false;
        }
        return TYPE.equalsIgnoreCase(type);
    }
}
