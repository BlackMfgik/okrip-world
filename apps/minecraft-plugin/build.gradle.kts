plugins { java }
group = "world.okrip"
version = "1.2.0"
repositories { mavenCentral(); maven("https://repo.papermc.io/repository/maven-public/") }
dependencies {
    compileOnly("io.papermc.paper:paper-api:26.2.build.121-stable")
    compileOnly("com.google.code.gson:gson:2.11.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.12.2")
    testImplementation("com.google.code.gson:gson:2.11.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
java { toolchain.languageVersion.set(JavaLanguageVersion.of(26)) }
tasks.withType<JavaCompile> { options.encoding = "UTF-8"; options.release.set(25) }
tasks.test {
    useJUnitPlatform()
    val junitTemp = layout.buildDirectory.dir("tmp/junit")
    doFirst { junitTemp.get().asFile.mkdirs() }
    systemProperty("java.io.tmpdir", junitTemp.get().asFile.absolutePath)
}
tasks.jar { archiveFileName.set("OkripWhitelist.jar") }
