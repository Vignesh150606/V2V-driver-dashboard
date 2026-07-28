//
// Pattern verified against veins/modules/application/traci/TraCIDemo11p.ned (veins-5.3.1).
// Place this file in the SAME source folder as HazardApp.h/.cc so the package path matches.
//
package org.car2x.veins.modules.application.traci;
import org.car2x.veins.modules.application.ieee80211p.DemoBaseApplLayer;

simple HazardApp extends DemoBaseApplLayer
{
    parameters:
        @class(veins::HazardApp);
        string logFile = default("results/scenario2_dataset.csv");
        int scenarioId = default(2);              // 2 = U-turn, 3 = Braking Relay, 4 = Blind Intersection
        double turnSpeedThreshold = default(3);  // m/s (NOTE: no @unit — plain double, see build notes)
        double waitTimeThreshold = default(4);   // s, TTC-style threshold

        // Scenario 3 (Braking Relay) only
        int chainLength = default(3);             // total cars in the chain: car1..carN
        double brakeTriggerTime = default(15);    // s, when car1's scripted brake fires
        double brakeTargetSpeed = default(3);     // m/s, target speed car1 slows to
        double brakeDuration = default(2);        // s, duration of the TraCI slowDown transition

        // Scenario 4 (Blind Intersection) only
        double intersectionCenterX = default(500);      // m, must match nod.xml's n_c coordinates
        double intersectionCenterY = default(500);
        double collisionWindowThreshold = default(2.5); // s, ETA-gap threshold for WAIT_INTERSECTION
        double relevantRadius = default(150);            // m, only evaluate within this range of center
        double beaconInterval = default(0.5);             // s, how often carX/carY broadcast their status

        // Batch-run metadata — overridden per run via run_params.ini (see run_batch*.ps1).
        // Purely descriptive: recorded into the CSV, not used in any decision logic.
        int runNumber = default(0);
        int randomSeedUsed = default(0);
        double initialGapM = default(-1);
        double carASpeedInit = default(-1);
        double carBSpeedInit = default(-1);

        @display("i=block/app2");
}
