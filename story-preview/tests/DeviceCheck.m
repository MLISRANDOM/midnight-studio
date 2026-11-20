// Simulator-only host for the actual production page and its browser test.
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface Check : UIResponder <UIApplicationDelegate>
@property(nonatomic,strong) UIWindow *window;
@end
@implementation Check
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
    NSURL *url = [NSURL URLWithString:NSProcessInfo.processInfo.environment[@"MOTION_TEST_URL"]];
    if (![url.host isEqual:@"127.0.0.1"]) return NO;
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    UIViewController *vc = [UIViewController new];
    WKWebViewConfiguration *config = [WKWebViewConfiguration new];
    config.allowsInlineMediaPlayback = YES;
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    WKWebView *web = [[WKWebView alloc] initWithFrame:self.window.bounds configuration:config];
    vc.view = web;
    self.window.rootViewController = vc;
    [self.window makeKeyAndVisible];
    [web loadRequest:[NSURLRequest requestWithURL:url]];
    return YES;
}
@end
int main(int argc,char **argv) {
    @autoreleasepool { return UIApplicationMain(argc,argv,nil,NSStringFromClass(Check.class)); }
}
