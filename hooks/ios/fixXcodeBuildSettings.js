#!/usr/bin/env node
/*
  Hook: fixXcodeBuildSettings
  Runs after prepare to patch platforms/ios/*.xcodeproj/project.pbxproj
  - Sets ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES to $(inherited)
  - Ensures LD_RUNPATH_SEARCH_PATHS contains $(inherited)
*/
module.exports = function (context) {
    const fs = require('fs');
    const path = require('path');

    const root = (context && context.opts && context.opts.projectRoot) ? context.opts.projectRoot : process.cwd();
    const iosDir = path.join(root, 'platforms', 'ios');
    if (!fs.existsSync(iosDir)) {
        console.log('fixXcodeBuildSettings: platforms/ios not found, skipping');
        return;
    }

    const entries = fs.readdirSync(iosDir);
    const xcodeprojDirs = entries.filter(e => e.match(/\.xcodeproj$/));
    xcodeprojDirs.forEach(projDir => {
        const pbxPath = path.join(iosDir, projDir, 'project.pbxproj');
        if (!fs.existsSync(pbxPath)) return;

        let content = fs.readFileSync(pbxPath, 'utf8');
        const original = content;

        // Replace common YES assignment for ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES
        content = content.replace(/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;/g, 'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = $(inherited);');
        content = content.replace(/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = "YES";/g, 'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = $(inherited);');

        // Ensure LD_RUNPATH_SEARCH_PATHS contains $(inherited)
        // Case 1: array form
        content = content.replace(/LD_RUNPATH_SEARCH_PATHS = \(\n([\s\S]*?)\n\s*\);/g, function (match, inner) {
            if (inner.indexOf('$(inherited)') !== -1) return match;
            // insert $(inherited) as first element
            const newInner = '\t\t\t\t$(inherited),\n' + inner;
            return 'LD_RUNPATH_SEARCH_PATHS = (\n' + newInner + '\n\t\t\t);';
        });

        // Case 2: single-line string assignment
        content = content.replace(/LD_RUNPATH_SEARCH_PATHS = "([^"]*)";/g, function (match, inner) {
            if (inner.indexOf('$(inherited)') !== -1) return match;
            // prefer the array form with inheriting and Frameworks
            return 'LD_RUNPATH_SEARCH_PATHS = ($(inherited) @executable_path/Frameworks);';
        });

        if (content !== original) {
            try {
                fs.copyFileSync(pbxPath, pbxPath + '.bak');
            } catch (e) {
                // ignore backup errors
            }
            fs.writeFileSync(pbxPath, content, 'utf8');
            console.log('fixXcodeBuildSettings: patched', pbxPath);
        } else {
            console.log('fixXcodeBuildSettings: no changes needed for', pbxPath);
        }
    });
};
