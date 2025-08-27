````mermaid
erDiagram
USERS ||--o{ ADDRESSES : has
USERS ||--o{ HOBBIES : has
USERS ||--o{ FRIENDSHIPS : "user_id_1"
USERS ||--o{ FRIENDSHIPS : "user_id_2"
USERS ||--o{ LIKES : "liker_user_id"
USERS ||--o{ LIKES : "liked_user_id"
USERS ||--o{ CONVERSATIONS_USERS : participates
USERS ||--o{ MESSAGES : sends
USERS ||--o{ USER_PHOTOS : has

CONVERSATIONS ||--o{ CONVERSATIONS_USERS : includes
CONVERSATIONS ||--o{ MESSAGES : contains

USERS {
    int id
    varchar email
    varchar password
    varchar first_name
    varchar last_name
}

ADDRESSES {
    int id
    int user_id
    varchar street
    varchar city
}

HOBBIES {
    int id
    int user_id
    varchar name
    int rating
}

FRIENDSHIPS {
    int id
    int user_id_1
    int user_id_2
    varchar status
}

LIKES {
    int id
    int liker_user_id
    int liked_user_id
    varchar status
}

CONVERSATIONS {
    int id
    timestamp created_at
}

CONVERSATIONS_USERS {
    int conversation_id
    int user_id
}

MESSAGES {
    int id
    int conversation_id
    int sender_user_id
    text message_text
}

USER_PHOTOS {
    int id
    int user_id
    bytea data
    varchar url
    boolean is_profile_picture
}
````