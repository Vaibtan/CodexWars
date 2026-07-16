# M0 marker-colocation results

**Status:** NOT PASSED — native build verification is complete, but the required physical Android/iPhone measurements have not been run.

**Test date:** 2026-07-16

**Source commit:** `9721d51` (merged to `main` by `c5763d6`)

**Marker:** `output/pdf/codexwars-arena-marker-a4.pdf`, printed at 100% / Actual size with a 180 mm black square

## Automated and build evidence

| Check | Result | Evidence |
|---|---|---|
| Marker-space coordinate tests | PASS | Translation, marker yaw removal, and stale/vertical aim rejection pass. |
| Mobile native-identity tests | PASS | Shared marker scene, retained participant navigator, organizer integration, and synchronized GLB rendering checks pass. |
| Android Metro export | PASS | Expo exported the Android Hermes bundle and all marker/GLB assets. |
| ARM64 Android development APK | PASS | Gradle `assembleDebug` completed successfully; package `com.codexwars.app`; SHA-256 `70342CE6A805374BD04345FF9604189339769F491DADFBA34CB21713B1ABE3A4`. |
| Physical Android camera test | NOT RUN | `adb devices -l` reported no connected or authorized device. |
| Physical iPhone camera test | NOT RUN | No iPhone/macOS signing environment was available in this Windows session. |

The successful Android build command was:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\hp\AppData\Local\Android\Sdk'
$env:GRADLE_OPTS='-Dkotlin.compiler.execution.strategy=in-process'
.\gradlew.bat --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a assembleDebug --console=plain
```

## Physical acceptance measurements

Fill this table using the same printed marker and the same commit on one ARCore-capable Android phone and one ARKit-capable iPhone. The exact thresholds are owned by `docs/AR_IMPLEMENTATION_SPEC.md`.

| Measurement | Android result | iPhone result | Pass? |
|---|---:|---:|---|
| Device model and OS | Not measured | Not measured | — |
| Acquisition success, 10 trials | Not measured | Not measured | — |
| Median acquisition time | Not measured | Not measured | — |
| Tracking-loss recovery | Not measured | Not measured | — |
| Cross-device point agreement | Not measured | Not measured | — |
| Heading error | Not measured | Not measured | — |
| Three-minute drift | Not measured | Not measured | — |
| Stale-pose firing shutdown | Not measured | Not measured | — |
| All enabled GLB variants render; configured animations play | Not measured | Not measured | — |
| Two complete mixed-platform rounds | Not measured | Not measured | — |

M0 may be changed to **PASS** only after every required physical measurement passes on both platforms. A successful build, emulator run, or single-platform camera test is insufficient.
