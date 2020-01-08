/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


#import "ViewController.h"
#import  <iModelJsHost/IModelJsHost.h>
@interface ViewController ()

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];

    // Do any additional setup after loading the view.

}
+ (void)clearTmpDirectory
{
    NSArray* tmpDirectory = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:NSTemporaryDirectory() error:NULL];
    for (NSString *file in tmpDirectory) {
        [[NSFileManager defaultManager] removeItemAtPath:[NSString stringWithFormat:@"%@%@", NSTemporaryDirectory(), file] error:NULL];
    }
}

- (IBAction)startStandardTest:(id)sender {
    UIBarButtonItem* button = sender;
    [button setEnabled:NO];
    [ViewController clearTmpDirectory];
    NSString* appRoot = @"Assets";
    NSURL* mainJS = [[NSURL alloc] initWithString: @"runMochaTestsDirectly.js"];
    [[IModelJsHost sharedInstance] loadBackend:mainJS
                                              :@[@"Assets"] // directory containing the mainJS
                                              :appRoot]; // allow presentation rules to load

    JSContext* context = [[IModelJsHost sharedInstance] getContext];
    context[@"process"][@"mocha_log"] = ^(NSString* text, NSString* msg) {
        dispatch_async(dispatch_get_main_queue(), ^{
            // do work here
            NSString* tmp =
            [[self.textView.text stringByAppendingString:msg] stringByAppendingString:@"\n"];

            self.textView.text = tmp;
            [self.textView scrollRangeToVisible:NSMakeRange(tmp.length, 0)];
        });
    };
    context[@"process"][@"mocha_complete"] = ^(NSString* text, NSString* msg) {
        dispatch_async(dispatch_get_main_queue(), ^{
           [button setEnabled:YES];
        });
    };
}
@end
