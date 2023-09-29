function getMediaURL(status_id, json) {
    let _json = json || this.fetchJson(status_id);
    let tweet = _json.legacy;
    let medias = tweet.extended_entities && tweet.extended_entities.media;
    if (medias.length > 0) {
        return medias.map(media => {
            const url = media.type === 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type === 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
            return {
                media_url: url,
                format: url.split('.').pop().split(':')[0].split('?')[0],
                type: media.type
            }
        })
    } else {
        return [];
    }
}
function fetchJson(status_id) {
    let host = location.hostname;
    let base_url = `https://${host}/i/api/graphql/NmCeCgkVlsRGS1cAwqtgmw/TweetDetail`;
    let variables = {
        "focalTweetId":status_id,
        "with_rux_injections":false,
        "includePromotedContent":true,
        "withCommunity":true,
        "withQuickPromoteEligibilityTweetFields":true,
        "withBirdwatchNotes":true,
        "withVoice":true,
        "withV2Timeline":true
    };
    let features = {
        "rweb_lists_timeline_redesign_enabled":true,
        "responsive_web_graphql_exclude_directive_enabled":true,
        "verified_phone_label_enabled":false,
        "creator_subscriptions_tweet_preview_api_enabled":true,
        "responsive_web_graphql_timeline_navigation_enabled":true,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,
        "tweetypie_unmention_optimization_enabled":true,
        "responsive_web_edit_tweet_api_enabled":true,
        "graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,
        "view_counts_everywhere_api_enabled":true,
        "longform_notetweets_consumption_enabled":true,
        "responsive_web_twitter_article_tweet_consumption_enabled":false,
        "tweet_awards_web_tipping_enabled":false,
        "freedom_of_speech_not_reach_fetch_enabled":true,
        "standardized_nudges_misinfo":true,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,
        "longform_notetweets_rich_text_read_enabled":true,
        "longform_notetweets_inline_media_enabled":true,
        "responsive_web_media_download_video_enabled":false,
        "responsive_web_enhance_cards_enabled":false,
        "responsive_web_home_pinned_timelines_enabled": true
    };
    let url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
    let cookies = this.getCookie();
    let headers = {
        'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': cookies.lang,
        'x-csrf-token': cookies.ct0
    };
    if (cookies.ct0.length === 32) headers['x-guest-token'] = cookies.gt;
    let tweet_detail = async () => {
        const result = await fetch(url, {headers: headers});
        return await result.json();
    }
    console.log(tweet_detail)
    let tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId === `tweet-${status_id}`);
    let tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
    return tweet_result.tweet || tweet_result;
}
function getCookie(name) {
    let cookies = {};
    document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
        n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
            cookies[name.trim()] = value.trim();
        });
    });
    return name ? cookies[name] : cookies;
}
